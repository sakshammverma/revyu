import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.models.lead import Lead
from app.services.gap_report import Business, GapReport, build_report
from app.services.notifications.email_backend import EmailBackend
from app.services.places import PlacesUnavailableError

router = APIRouter(prefix="/api/gap-report", tags=["gap-report"])

_email = EmailBackend()


class BusinessOut(BaseModel):
    place_id: str
    name: str
    rating: float | None
    review_count: int | None


class GapReportOut(BaseModel):
    business: BusinessOut
    competitors: list[BusinessOut]
    review_gap: int
    rank_by_reviews: int
    group_size: int
    headline: str


def _b(b: Business) -> BusinessOut:
    return BusinessOut(place_id=b.place_id, name=b.name, rating=b.rating, review_count=b.review_count)


def _out(r: GapReport) -> GapReportOut:
    return GapReportOut(
        business=_b(r.business),
        competitors=[_b(c) for c in r.competitors],
        review_gap=r.review_gap,
        rank_by_reviews=r.rank_by_reviews,
        group_size=r.group_size,
        headline=r.headline,
    )


def _report_or_503(place_id: str) -> GapReport:
    try:
        return build_report(place_id)
    except PlacesUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail={"error": {"code": "PLACES_UNAVAILABLE", "message": str(exc)}}
        ) from exc


@router.get("", response_model=GapReportOut, dependencies=[Depends(rate_limit("gap", 20, 3600))])
def get_gap_report(place_id: str = Query(min_length=3, max_length=200)) -> GapReportOut:
    return _out(_report_or_503(place_id))


class EmailReportBody(BaseModel):
    place_id: str = Field(min_length=3, max_length=200)
    email: EmailStr


@router.post("/email", status_code=202, dependencies=[Depends(rate_limit("gap_email", 5, 3600))])
def email_gap_report(body: EmailReportBody, db: Session = Depends(get_db)) -> dict:
    report = _report_or_503(body.place_id)
    db.add(
        Lead(
            id=uuid.uuid4(),
            email=str(body.email).lower(),
            place_id=body.place_id,
            business_name=report.business.name,
        )
    )
    db.commit()

    lines = "\n".join(
        f"- {c.name}: {c.review_count} reviews, rating {c.rating}" for c in report.competitors
    )
    base = get_settings().frontend_base_url.rstrip("/")
    _email.send(
        to_email=str(body.email),
        template="gap_report",
        data={
            "business_name": report.business.name,
            "headline": report.headline,
            "competitor_lines": lines or "- (none found nearby)",
            "signup_url": f"{base}/signup?place={body.place_id}",
        },
    )
    return {"status": "sent"}
