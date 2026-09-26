from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DestinationBase(BaseModel):
    name: str
    state: str
    region: Optional[str] = None
    category: Optional[str] = None
    mood: Optional[str] = None
    latitude: float
    longitude: float
    image_url: Optional[str] = None
    description: Optional[str] = None
    budget_per_day: Optional[int] = None
    tags: Optional[str] = None

class DestinationCreate(DestinationBase):
    pass

class DestinationResponse(DestinationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
