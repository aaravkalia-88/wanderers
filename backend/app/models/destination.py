from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.session import Base

class Destination(Base):
    __tablename__ = "destinations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    state = Column(String, index=True, nullable=False)
    region = Column(String)
    category = Column(String, index=True)
    mood = Column(String, index=True)
    
    latitude = Column(Float)
    longitude = Column(Float)
    
    image_url = Column(String)
    description = Column(Text)
    budget_per_day = Column(Integer)
    tags = Column(String) # JSON or comma-separated
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
