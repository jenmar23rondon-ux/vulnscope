from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models import Scan, User, Vulnerability

router = APIRouter(prefix="/vulnerabilities", tags=["vulnerabilities"])


@router.get("/search")
def search_vulnerabilities(
    search: str = Query("", max_length=255),
    severity: Literal["all", "LOW", "MEDIUM", "HIGH", "CRITICAL", "HIGH_CRITICAL"] = "all",
    sort: Literal["risk", "newest"] = "risk",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = db.query(Vulnerability, Scan.target).join(Scan, Scan.id == Vulnerability.scan_id)
    if search.strip():
        term = search.strip().lower()
        query = query.filter(or_(
            func.lower(Vulnerability.cve).contains(term, autoescape=True),
            func.lower(Vulnerability.description).contains(term, autoescape=True),
            func.lower(Scan.target).contains(term, autoescape=True),
        ))
    if severity == "HIGH_CRITICAL":
        query = query.filter(Vulnerability.severity.in_(["HIGH", "CRITICAL"]))
    elif severity != "all":
        query = query.filter(Vulnerability.severity == severity)
    total = query.count()
    page = min(page, max(1, (total + page_size - 1) // page_size))
    order = (Vulnerability.cvss_score.desc(), Vulnerability.id.desc()) if sort == "risk" else (Vulnerability.id.desc(),)
    rows = query.order_by(*order).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [{"id": item.id, "scan_id": item.scan_id, "target": target, "cve": item.cve,
                   "severity": item.severity, "description": item.description, "cvss_score": item.cvss_score}
                  for item, target in rows],
        "total": total, "page": page, "page_size": page_size,
    }


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
