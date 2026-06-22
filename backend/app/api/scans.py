from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_roles
from app.database.session import SessionLocal, get_db
from app.models import Port, Scan, ScheduledScan, User, Vulnerability
from app.services.cve_lookup import lookup_cves
from app.services.port_scanner import COMMON_PORTS, scan_ports
from app.services.risk_calculator import calculate_risk

router = APIRouter(prefix="/scans", tags=["scans"])


class ScanInput(BaseModel):
    target: str = Field(..., examples=["127.0.0.1"])
    ports: list[int] | None = None


class ScheduledScanInput(ScanInput):
    interval_minutes: int = Field(1440, ge=15, le=43200)


def serialize_scan(scan: Scan) -> dict:
    return {
        "id": scan.id,
        "target": scan.target,
        "status": scan.status,
        "risk_score": scan.risk_score,
        "started_at": scan.started_at,
        "finished_at": scan.finished_at,
        "ports": [
            {
                "id": port.id,
                "port": port.port,
                "protocol": port.protocol,
                "service": port.service,
                "state": port.state,
            }
            for port in scan.ports
        ],
        "vulnerabilities": [
            {
                "id": vuln.id,
                "cve": vuln.cve,
                "severity": vuln.severity,
                "description": vuln.description,
                "cvss_score": vuln.cvss_score,
            }
            for vuln in scan.vulnerabilities
        ],
    }


def _run_scan_job(scan_id: int, target: str, ports: list[int] | None) -> None:
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            return
        scan.status = "running"
        db.commit()

        port_results = scan_ports(target, ports or COMMON_PORTS)
        vulnerability_results: list[dict] = []

        for result in port_results:
            db.add(Port(scan_id=scan.id, **result))
            if result["state"] == "open":
                vulnerability_results.extend(lookup_cves(result["service"]))

        for vulnerability in vulnerability_results:
            db.add(Vulnerability(scan_id=scan.id, **vulnerability))

        open_ports = len([port for port in port_results if port["state"] == "open"])
        scan.risk_score = calculate_risk(open_ports, vulnerability_results)
        scan.status = "completed"
        scan.finished_at = datetime.utcnow()
        db.commit()
    except Exception:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            scan.status = "failed"
            scan.finished_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


@router.post("")
def create_scan(
    payload: ScanInput,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin", "analyst")),
):
    scan = Scan(target=payload.target, status="queued")
    db.add(scan)
    db.commit()
    db.refresh(scan)
    background_tasks.add_task(_run_scan_job, scan.id, payload.target, payload.ports)
    return serialize_scan(scan)


@router.get("")
def list_scans(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    scans = db.query(Scan).order_by(Scan.started_at.desc()).limit(25).all()
    return [serialize_scan(scan) for scan in scans]


@router.get("/{scan_id}")
def get_scan(scan_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return serialize_scan(scan)


@router.post("/scheduled")
def create_scheduled_scan(
    payload: ScheduledScanInput,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin", "analyst")),
):
    scheduled = ScheduledScan(
        target=payload.target,
        ports=",".join(str(port) for port in payload.ports) if payload.ports else None,
        interval_minutes=payload.interval_minutes,
        next_run_at=datetime.utcnow() + timedelta(minutes=payload.interval_minutes),
    )
    db.add(scheduled)
    db.commit()
    db.refresh(scheduled)
    return {
        "id": scheduled.id,
        "target": scheduled.target,
        "ports": scheduled.ports,
        "interval_minutes": scheduled.interval_minutes,
        "active": scheduled.active,
        "next_run_at": scheduled.next_run_at,
    }


@router.get("/scheduled")
def list_scheduled_scans(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin", "analyst")),
):
    items = db.query(ScheduledScan).order_by(ScheduledScan.created_at.desc()).limit(50).all()
    return [
        {
            "id": item.id,
            "target": item.target,
            "ports": item.ports,
            "interval_minutes": item.interval_minutes,
            "active": item.active,
            "next_run_at": item.next_run_at,
        }
        for item in items
    ]
