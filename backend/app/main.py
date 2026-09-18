import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.admin import router as admin_router
from app.api.admin_outlets import router as admin_outlets_router
from app.api.admin_ops import router as admin_ops_router
from app.api.assets import router as assets_router
from app.api.competitors import router as competitors_router
from app.api.billing import router as billing_router
from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.events import router as events_router
from app.api.flow import router as flow_router
from app.api.gap_report import router as gap_report_router
from app.api.referrals import router as referrals_router
from app.api.growth import admin_router as growth_admin_router
from app.api.growth import owner_router as growth_owner_router
from app.api.hub_config import admin_router as hub_admin_router
from app.api.hub_config import owner_router as hub_owner_router
from app.api.hub_public import router as hub_public_router
from app.api.signup import router as signup_router
from app.api.staff import router as staff_router
from app.api.webhooks import router as webhooks_router
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.services.storage import UPLOAD_DIR
from app.jobs.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


settings = get_settings()

if settings.environment == "local":
    # Without an email provider key, OTP codes and magic links are only
    # written to the `revyu.notifications` logger at INFO — make them visible.
    logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Revyu API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(flow_router)
app.include_router(events_router)
app.include_router(signup_router)
app.include_router(admin_router)
app.include_router(admin_outlets_router)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(assets_router)
app.include_router(webhooks_router)
app.include_router(hub_public_router)
app.include_router(hub_owner_router)
app.include_router(hub_admin_router)
app.include_router(growth_owner_router)
app.include_router(growth_admin_router)
app.include_router(staff_router)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.include_router(gap_report_router)
app.include_router(billing_router)
app.include_router(referrals_router)
app.include_router(competitors_router)
app.include_router(admin_ops_router)


@app.get("/health")
def health() -> dict:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        db.close()
    return {"status": "ok", "db": db_ok}
