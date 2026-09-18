import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.models.account import Account
from app.models.competitor import CompetitorWatch
from app.models.outlet import Outlet
from app.services import competitors as svc

router = APIRouter(prefix="/api/app/competitors", tags=["competitors"])


class StandingOut(BaseModel):
    id: uuid.UUID | None = None
    name: str
    rating: float | None
    review_count: int | None
    delta: int | None


class CompetitorsOut(BaseModel):
    limit: int
    me: StandingOut
    competitors: list[StandingOut]
    headline: str


class AddBody(BaseModel):
    place_id: str = Field(min_length=3, max_length=200)
    name: str = Field(min_length=1, max_length=120)


def _outlet(db: Session, owner: Account) -> Outlet:
    outlet = db.scalar(select(Outlet).where(Outlet.account_id == owner.id))
    if outlet is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return outlet


def _out(db: Session, outlet: Outlet) -> CompetitorsOut:
    me, rivals = svc.standings(db, outlet)
    return CompetitorsOut(
        limit=svc.MAX_WATCHES,
        me=StandingOut(name=me.name, rating=me.rating, review_count=me.review_count, delta=me.delta),
        competitors=[
            StandingOut(id=w.id, name=s.name, rating=s.rating, review_count=s.review_count, delta=s.delta)
            for w, s in rivals
        ],
        headline=svc.headline(me, [s for _, s in rivals]),
    )


@router.get("", response_model=CompetitorsOut)
def list_competitors(owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)) -> CompetitorsOut:
    return _out(db, _outlet(db, owner))


@router.post("", response_model=CompetitorsOut, status_code=201)
def add_competitor(
    body: AddBody, owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)
) -> CompetitorsOut:
    outlet = _outlet(db, owner)
    try:
        svc.add_watch(db, outlet, body.place_id, body.name)
    except svc.WatchError as exc:
        raise HTTPException(status_code=409, detail={"error": {"code": exc.code}}) from exc
    db.commit()
    return _out(db, outlet)


@router.delete("/{watch_id}", response_model=CompetitorsOut)
def remove_competitor(
    watch_id: uuid.UUID, owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)
) -> CompetitorsOut:
    outlet = _outlet(db, owner)
    watch = db.get(CompetitorWatch, watch_id)
    if watch is None or watch.outlet_id != outlet.id:  # SRS-15.6: own data only
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND"}})
    db.delete(watch)
    db.commit()
    return _out(db, outlet)
