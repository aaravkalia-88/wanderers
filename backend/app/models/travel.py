from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, UniqueConstraint, JSON
from app.db.session import Base

class TravelEntry(Base):
    __tablename__ = 'travel_entries'
    __table_args__ = (UniqueConstraint('user_id', 'place_id', name='uq_user_place'),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    place_id = Column(Integer, ForeignKey('destinations.id'), nullable=False)
    status = Column(String, nullable=False, default='Saved')
    visit_date = Column(Date, nullable=True)
    notes = Column(Text, default='')
    rating = Column(Integer, default=5)
    stamp_id = Column(String, nullable=True)

class TripPlan(Base):
    __tablename__ = 'trip_plans'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    data = Column(JSON, nullable=False)
