from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models import Scan, User
from app.services.report_generator import generate_scan_csv, generate_scan_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{scan_id}.pdf")
def download_pdf(scan_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return Response(
        generate_scan_pdf(scan),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=vulnscope-scan-{scan_id}.pdf"},
    )


@router.get("/{scan_id}.csv")
def download_csv(scan_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return Response(
        generate_scan_csv(scan),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=vulnscope-scan-{scan_id}.csv"},
    )
