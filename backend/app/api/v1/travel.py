from datetime import date
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.session import get_db
from app.models.travel import TravelEntry, TripPlan
from app.api.v1.auth import current_user
from app.services.travel import BY_ID, progression
from app.core.cache import cache_get, cache_set, cache_invalidate_prefix

router = APIRouter()

PASSPORT_TTL = 300  # 5 minutes
TRIPS_TTL = 300     # 5 minutes


class EntryInput(BaseModel):
    status: Literal[
        "Not Visited", "Saved", "Want To Visit", "Exploring", "Visited"
    ]
    visit_date: date | None = None
    notes: str = Field(default="", max_length=3000)
    rating: int = Field(default=5, ge=1, le=5)


class RoutePointInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class TripInput(BaseModel):
    place_id: int
    origin: str = Field(min_length=1, max_length=120)
    origin_point: RoutePointInput | None = None
    stop_ids: list[int] = Field(default_factory=list, max_length=3)
    start: date
    days: int = Field(ge=1, le=14)
    travelers: int = Field(ge=1, le=12)
    budget: int = Field(ge=500, le=1000000)
    mode: Literal["driving", "walking", "transit"]
    style: Literal["Slow travel", "Adventure", "Culture"]


def _build_passport(user, db: Session) -> dict:
    """Build passport response and cache it."""
    entries = db.query(TravelEntry).filter_by(user_id=user.id).all()
    result = {
        "username": user.username,
        "is_guest": user.password_hash == "!",
        "entries": [
            {
                "place_id": e.place_id,
                "status": e.status,
                "visit_date": e.visit_date,
                "notes": e.notes,
                "rating": e.rating,
                "stamp_id": e.stamp_id,
            }
            for e in entries
        ],
        **progression(entries),
    }
    cache_set(f"passport:{user.id}", result, PASSPORT_TTL)
    return result


def _invalidate_user_cache(user_id: int) -> None:
    """Clear cached passport and trips for a user after a write."""
    cache_invalidate_prefix(f"passport:{user_id}")
    cache_invalidate_prefix(f"trips:{user_id}")


@router.get("/passport")
def passport(user=Depends(current_user), db: Session = Depends(get_db)):
    cached = cache_get(f"passport:{user.id}")
    if cached is not None and "is_guest" in cached:
        return cached
    return _build_passport(user, db)


@router.put("/passport/places/{place_id}")
def update_entry(
    place_id: int,
    data: EntryInput,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    if place_id not in BY_ID:
        raise HTTPException(404, "Destination not found")
    if data.status == "Visited" and (
        not data.visit_date or data.visit_date > date.today()
    ):
        raise HTTPException(422, "Choose a visit date on or before today")
    entry = (
        db.query(TravelEntry)
        .filter_by(user_id=user.id, place_id=place_id)
        .first()
    )
    if not entry:
        entry = TravelEntry(user_id=user.id, place_id=place_id)
        db.add(entry)
    for key, value in data.model_dump().items():
        setattr(entry, key, value)
    if data.status == "Visited":
        entry.stamp_id = entry.stamp_id or str(uuid4())[:8].upper()
    else:
        entry.visit_date = None
        entry.stamp_id = None
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "This destination was updated elsewhere. Please retry."
        )
    _invalidate_user_cache(user.id)
    return _build_passport(user, db)


@router.get("/trips")
def trips(user=Depends(current_user), db: Session = Depends(get_db)):
    cached = cache_get(f"trips:{user.id}")
    if cached is not None:
        return cached
    result = [
        {"id": t.id, **t.data}
        for t in db.query(TripPlan)
        .filter_by(user_id=user.id)
        .order_by(TripPlan.id.desc())
        .all()
    ]
    cache_set(f"trips:{user.id}", result, TRIPS_TTL)
    return result


@router.post("/trips")
def save_trip(
    data: TripInput,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    if data.place_id not in BY_ID:
        raise HTTPException(404, "Destination not found")
    if any(stop not in BY_ID for stop in data.stop_ids):
        raise HTTPException(404, "Route stop not found")
    if len(set(data.stop_ids)) != len(data.stop_ids) or data.place_id in data.stop_ids:
        raise HTTPException(
            422, "Route stops must be unique and different from the destination"
        )
    if not data.origin.strip():
        raise HTTPException(422, "Enter a starting city")
    if data.start < date.today():
        raise HTTPException(422, "Trip start must be today or later")
    trip = TripPlan(user_id=user.id, data=data.model_dump(mode="json"))
    db.add(trip)
    db.commit()
    db.refresh(trip)
    _invalidate_user_cache(user.id)
    return {"id": trip.id, **trip.data}
