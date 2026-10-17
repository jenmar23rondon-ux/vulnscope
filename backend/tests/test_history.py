"""Exercise history queries and destructive resets against a disposable database."""
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

scratch = TemporaryDirectory(prefix="vulnscope-history-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{(Path(scratch.name) / 'history.db').as_posix()}"
os.environ["JWT_SECRET"] = "isolated-history-test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import event

from app.database.session import Base, SessionLocal, engine
from app.main import app
from app.models import Port, Report, Scan, ScheduledScan, User, Vulnerability
from app.utils.security import create_access_token, hash_password


class HistoryTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.client_context = TestClient(app, raise_server_exceptions=False)
        self.client = self.client_context.__enter__()
        with SessionLocal() as db:
            db.add(User(email="analyst@example.com", password=hash_password("test-password"), role="analyst"))
            for index in range(32):
                scan = Scan(target=f"asset-{index}.test", status="completed", risk_score=index * 3)
                db.add(scan)
                db.flush()
                if index == 0:
                    db.add_all([
                        Port(scan_id=scan.id, port=443, protocol="tcp", service="https", state="open"),
                        Vulnerability(scan_id=scan.id, cve="CVE-TEST", severity="HIGH", description="Fixture", cvss_score=8),
                        Report(scan_id=scan.id, pdf_path="test-report.pdf"),
                    ])
            db.add(Scan(target="100%literal.test", status="failed", risk_score=0))
            db.add(ScheduledScan(target="scheduled.test", interval_minutes=1440))
            db.commit()
        self.admin = {"Authorization": f"Bearer {create_access_token('admin@vulnscope.local', 'admin')}"}
        self.analyst = {"Authorization": f"Bearer {create_access_token('analyst@example.com', 'analyst')}"}

    def tearDown(self):
        self.client_context.__exit__(None, None, None)

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        scratch.cleanup()

    def reset(self, headers=None, confirmation="REINICIAR"):
        return self.client.request("DELETE", "/scans/history", headers=headers or self.admin, json={"confirmation": confirmation})

    def test_history_paginates_beyond_old_25_record_limit(self):
        first = self.client.get("/scans/history", headers=self.admin).json()
        last = self.client.get("/scans/history?page=99", headers=self.admin).json()
        self.assertEqual((first["total"], len(first["items"])), (33, 10))
        self.assertEqual((last["page"], len(last["items"])), (4, 3))
        self.assertEqual(len({item["id"] for item in first["items"] + last["items"]}), 13)

    def test_history_filters_and_sorts(self):
        filtered = self.client.get("/scans/history?search=ASSET-1&status=completed&sort=risk", headers=self.admin).json()
        self.assertEqual(filtered["total"], 11)
        risks = [item["risk_score"] for item in filtered["items"]]
        self.assertEqual(risks, sorted(risks, reverse=True))
        literal = self.client.get("/scans/history", params={"search": "%"}, headers=self.admin).json()
        self.assertEqual([item["target"] for item in literal["items"]], ["100%literal.test"])

    def test_history_requires_auth_and_valid_pagination(self):
        self.assertIn(self.client.get("/scans/history").status_code, (401, 403))
        self.assertEqual(self.client.get("/scans/history?page=0", headers=self.admin).status_code, 422)
        self.assertEqual(self.client.get("/scans/history?page_size=1000", headers=self.admin).status_code, 422)

    def test_reset_denies_unauthenticated_and_non_admin_users(self):
        self.assertIn(self.client.request("DELETE", "/scans/history", json={"confirmation": "REINICIAR"}).status_code, (401, 403))
        self.assertEqual(self.reset(headers=self.analyst).status_code, 403)
        with SessionLocal() as db:
            self.assertEqual(db.query(Scan).count(), 33)

    def test_reset_requires_exact_confirmation(self):
        self.assertEqual(self.reset(confirmation="yes").status_code, 422)
        with SessionLocal() as db:
            self.assertEqual(db.query(Scan).count(), 33)

    def test_reset_clears_all_results_and_metrics_but_keeps_accounts_and_schedules(self):
        response = self.reset()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted"], {"scans": 33, "ports": 1, "vulnerabilities": 1, "reports": 1})
        with SessionLocal() as db:
            for model in (Scan, Port, Vulnerability, Report):
                self.assertEqual(db.query(model).count(), 0)
            self.assertEqual(db.query(User).count(), 2)
            self.assertEqual(db.query(ScheduledScan).count(), 1)
        dashboard = self.client.get("/dashboard", headers=self.admin).json()
        for key in ("total_scans", "open_ports", "vulnerabilities", "high_or_critical", "average_risk"):
            self.assertEqual(dashboard[key], 0)
        self.assertEqual(dashboard["risk_trend"], [])
        self.assertEqual(dashboard["top_targets"], [])
        self.assertEqual(self.client.get("/scans/history", headers=self.admin).json()["items"], [])
        self.assertEqual(self.client.get("/reports/1.pdf", headers=self.admin).status_code, 404)
        self.assertEqual(self.reset().json()["deleted"]["scans"], 0)
        self.assertEqual(self.client.post("/auth/login", json={"email": "admin@vulnscope.local", "password": "Admin1234"}).status_code, 200)

    def test_reset_refuses_active_jobs_without_partial_deletion(self):
        for state in ("queued", "running"):
            with self.subTest(state=state):
                with SessionLocal() as db:
                    db.query(Scan).filter(Scan.id == 1).update({"status": state})
                    db.commit()
                self.assertEqual(self.reset().status_code, 409)
                with SessionLocal() as db:
                    self.assertEqual(db.query(Scan).count(), 33)
                    self.assertEqual(db.query(Report).count(), 1)

    def test_reset_rolls_back_every_deletion_if_database_write_fails(self):
        def fail_port_delete(conn, cursor, statement, parameters, context, executemany):
            if statement.startswith("DELETE FROM ports"):
                raise RuntimeError("Simulated database failure")
        event.listen(engine, "before_cursor_execute", fail_port_delete)
        try:
            self.assertEqual(self.reset().status_code, 500)
        finally:
            event.remove(engine, "before_cursor_execute", fail_port_delete)
        with SessionLocal() as db:
            self.assertEqual(db.query(Scan).count(), 33)
            self.assertEqual(db.query(Vulnerability).count(), 1)
            self.assertEqual(db.query(Report).count(), 1)

    def test_new_scans_work_after_reset_without_network_scanning(self):
        self.reset()
        with patch("app.api.scans.scan_ports", return_value=[{"port": 443, "protocol": "tcp", "service": "https", "state": "closed"}]):
            response = self.client.post("/scans", headers=self.admin, json={"target": "fixture.test", "ports": [443]})
        self.assertEqual(response.status_code, 200)
        scan_id = response.json()["id"]
        scan = self.client.get(f"/scans/{scan_id}", headers=self.admin).json()
        self.assertEqual((scan["target"], scan["status"]), ("fixture.test", "completed"))

    def test_public_registration_cannot_grant_reset_permission(self):
        response = self.client.post("/auth/register", json={"email": "new@example.com", "password": "test-password", "role": "admin"})
        self.assertEqual(response.status_code, 422)
        response = self.client.post("/auth/register", json={"email": "new@example.com", "password": "test-password"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "analyst")


if __name__ == "__main__":
    unittest.main()
