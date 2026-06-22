from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models import Port, Scan, User, Vulnerability
from app.services.cve_lookup import lookup_cves
from app.services.port_scanner import COMMON_PORTS, scan_ports
from app.services.risk_calculator import calculate_risk

router = APIRouter(prefix="/scans", tags=["scans"])


class ScanInput(BaseModel):
    target: str = Field(..., examples=["127.0.0.1"])
    ports: list[int] | None = None


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


@router.post("")
def create_scan(payload: ScanInput, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    scan = Scan(target=payload.target, status="running")
    db.add(scan)
    db.commit()
    db.refresh(scan)

    port_results = scan_ports(payload.target, payload.ports or COMMON_PORTS)
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
    db.refresh(scan)
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
