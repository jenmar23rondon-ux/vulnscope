from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models import Port, Scan, User, Vulnerability

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    scans = db.query(Scan).order_by(Scan.started_at.desc()).limit(10).all()
    vulnerabilities = db.query(Vulnerability).all()
    open_ports = db.query(Port).filter(Port.state == "open").count()
    critical = len([item for item in vulnerabilities if item.severity in ["HIGH", "CRITICAL"]])

    severity_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for vuln in vulnerabilities:
        severity_counts[vuln.severity] = severity_counts.get(vuln.severity, 0) + 1

    return {
        "total_scans": db.query(Scan).count(),
        "open_ports": open_ports,
        "vulnerabilities": len(vulnerabilities),
        "high_or_critical": critical,
        "average_risk": round(sum(scan.risk_score for scan in scans) / len(scans), 2) if scans else 0,
        "severity_counts": [{"severity": key, "count": value} for key, value in severity_counts.items()],
        "recent_scans": [
            {
                "id": scan.id,
                "target": scan.target,
                "status": scan.status,
                "risk_score": scan.risk_score,
                "started_at": scan.started_at,
            }
            for scan in scans
        ],
    }
