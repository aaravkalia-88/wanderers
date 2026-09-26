from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func
from app.db.session import Base


class PublicProfile(Base):
    __tablename__ = 'public_profiles'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    display_name = Column(String(80), nullable=False, default='')
    bio = Column(String(500), nullable=False, default='')
    home_region = Column(String(80), nullable=False, default='')
    interests = Column(String(300), nullable=False, default='')
    is_public = Column(Boolean, nullable=False, default=False)


class Blog(Base):
    __tablename__ = 'blogs'
    id = Column(Integer, primary_key=True)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    title = Column(String(160), nullable=False, default='')
    subtitle = Column(String(300), nullable=False, default='')
    body = Column(Text, nullable=False, default='')
    place_id = Column(Integer, ForeignKey('destinations.id'), nullable=True, index=True)
    status = Column(String(20), nullable=False, default='draft', index=True)
    hidden = Column(Boolean, nullable=False, default=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())


class BlogReport(Base):
    __tablename__ = 'blog_reports'
    __table_args__ = (UniqueConstraint('user_id', 'blog_id', name='uq_blog_report'),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    blog_id = Column(Integer, ForeignKey('blogs.id'), nullable=False, index=True)
    reason = Column(String(80), nullable=False)
    detail = Column(String(1000), nullable=False, default='')
    created_at = Column(DateTime, nullable=False, server_default=func.now())
