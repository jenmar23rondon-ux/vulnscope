from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, dashboard, reports, scans, vulnerabilities
from app.config import settings
from app.database.session import Base, SessionLocal, engine
from app.models import User
from app.utils.security import hash_password

app = FastAPI(title="VulnScope API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173", "http://localhost:5174"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@vulnscope.local").first()
        if not admin:
            db.add(User(email="admin@vulnscope.local", password=hash_password("Admin1234"), role="admin"))
            db.commit()
    finally:
        db.close()


@app.get("/")
def health():
    return {"name": settings.app_name, "status": "ok"}


app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(vulnerabilities.router)
app.include_router(reports.router)
app.include_router(dashboard.router)
