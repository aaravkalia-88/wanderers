from sqlalchemy import Column, Integer, String, JSON, CheckConstraint
from app.db.session import Base


class ResearchBudget(Base):
    __tablename__ = 'research_budget'
    __table_args__ = (CheckConstraint('spent_musd >= 0 AND reserved_musd >= 0'),)
    id = Column(Integer, primary_key=True)
    revision = Column(Integer, nullable=False, default=0)
    spent_musd = Column(Integer, nullable=False, default=0)
    reserved_musd = Column(Integer, nullable=False, default=0)
    quota_day = Column(String(10), nullable=False, default='')
    searches = Column(Integer, nullable=False, default=0)
    fetched_urls = Column(Integer, nullable=False, default=0)


class ResearchJob(Base):
    __tablename__ = 'research_jobs'
    id = Column(String(36), primary_key=True)
    owner_id = Column(Integer, nullable=False, index=True)
    fingerprint = Column(String(64), nullable=False, index=True)
    ip_hash = Column(String(64), nullable=False, index=True)
    request_data = Column(JSON, nullable=False)
    status = Column(String(20), nullable=False)
    provider_id = Column(String(128), nullable=True)
    result = Column(JSON, nullable=False, default=dict)
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
    expires_at = Column(Integer, nullable=False)
    reserved_musd = Column(Integer, nullable=False, default=0)
    step_cost_musd = Column(Integer, nullable=False, default=0)
    settled = Column(Integer, nullable=False, default=0)
