from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models import User, Vulnerability

router = APIRouter(prefix="/vulnerabilities", tags=["vulnerabilities"])


@router.get("")
def list_vulnerabilities(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    vulnerabilities = db.query(Vulnerability).order_by(Vulnerability.id.desc()).limit(100).all()
    return [
        {
            "id": vuln.id,
            "scan_id": vuln.scan_id,
            "cve": vuln.cve,
            "severity": vuln.severity,
            "description": vuln.description,
            "cvss_score": vuln.cvss_score,
        }
        for vuln in vulnerabilities
    ]
