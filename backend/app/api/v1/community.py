from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.api.v1.auth import current_user
from app.core.cache import rate_limit_check
from app.db.session import get_db
from app.models.community import Blog, BlogReport, PublicProfile
from app.models.user import User
from app.services.travel import BY_ID

router = APIRouter()


def account(user=Depends(current_user)):
    if user.password_hash == '!':
        raise HTTPException(403, 'Create an account to join the community. Your guest passport will be kept.')
    return user


def limit(user, action, count):
    if not rate_limit_check(f'community:{action}:{user.id}', count, 60):
        raise HTTPException(429, 'Please wait a minute before trying again.')


class ProfileInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    display_name: str = Field(max_length=80)
    bio: str = Field(max_length=500)
    home_region: str = Field(max_length=80)
    interests: str = Field(max_length=300)
    is_public: bool


def profile_data(user, profile):
    # Explicit allowlist: never serialize account or passport models publicly.
    return {'user_id': user.id, 'username': user.username,
            'display_name': profile.display_name if profile else user.username,
            'bio': profile.bio if profile else '',
            'home_region': profile.home_region if profile else '',
            'interests': profile.interests if profile else '',
            'is_public': bool(profile and profile.is_public)}


@router.get('/profiles/me')
def my_profile(user=Depends(account), db: Session = Depends(get_db)):
    return profile_data(user, db.get(PublicProfile, user.id))


@router.patch('/profiles/me')
def edit_profile(data: ProfileInput, user=Depends(account), db: Session = Depends(get_db)):
    limit(user, 'profile', 30)
    profile = db.get(PublicProfile, user.id)
    if not profile:
        profile = PublicProfile(user_id=user.id)
        db.add(profile)
    for key, value in data.model_dump().items():
        setattr(profile, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Your profile changed in another tab. Please reload.')
    return profile_data(user, profile)


@router.get('/profiles/u/{username}')
def public_profile(username: str, db: Session = Depends(get_db)):
    row = db.query(User, PublicProfile).join(PublicProfile, PublicProfile.user_id == User.id).filter(
        User.username == username, User.is_active.is_(True), PublicProfile.is_public.is_(True)).first()
    if not row:
        raise HTTPException(404, 'This profile is private or unavailable.')
    return profile_data(*row)


def public_blogs(db):
    return db.query(Blog, User, PublicProfile).join(User, Blog.author_id == User.id).join(
        PublicProfile, PublicProfile.user_id == User.id).filter(
        User.is_active.is_(True), PublicProfile.is_public.is_(True), Blog.hidden.is_(False))


def blog_data(blog, user, profile, full=False):
    place = BY_ID.get(blog.place_id)
    result = {'id': blog.id, 'title': blog.title, 'subtitle': blog.subtitle,
              'place_id': blog.place_id, 'destination': place['name'] if place else '',
              'state': place['state'] if place else '', 'category': place['group'] if place else '',
              'status': blog.status, 'hidden': blog.hidden, 'version': blog.version,
              'updated_at': blog.updated_at.isoformat() + 'Z',
              'author': {'username': user.username, 'display_name': profile.display_name or user.username if profile else user.username}}
    if full:
        result['body'] = blog.body
    return result


@router.get('/blogs')
def blogs(before: int | None = Query(None, gt=0), place_id: int | None = None,
          username: str | None = Query(None, max_length=40), category: str | None = Query(None, max_length=40),
          state: str | None = Query(None, max_length=80), q: str = Query('', max_length=160),
          db: Session = Depends(get_db)):
    query = public_blogs(db).filter(Blog.status == 'published')
    if before:
        query = query.filter(Blog.id < before)
    if place_id:
        query = query.filter(Blog.place_id == place_id)
    if username:
        query = query.filter(User.username == username)
    if q.strip():
        query = query.filter(Blog.title.icontains(q.strip(), autoescape=True))
    if category or state:
        ids = [key for key, place in BY_ID.items() if (not category or place['group'] == category) and (not state or place['state'] == state)]
        query = query.filter(Blog.place_id.in_(ids))
    rows = query.order_by(Blog.id.desc()).limit(13).all()
    return {'items': [blog_data(*row) for row in rows[:12]], 'next': rows[11][0].id if len(rows) > 12 else None}


@router.get('/blogs/mine')
def my_blogs(before: int | None = Query(None, gt=0), user=Depends(account), db: Session = Depends(get_db)):
    query = db.query(Blog).filter(Blog.author_id == user.id)
    if before:
        query = query.filter(Blog.id < before)
    rows = query.order_by(Blog.id.desc()).limit(13).all()
    profile = db.get(PublicProfile, user.id)
    return {'items': [blog_data(row, user, profile) for row in rows[:12]], 'next': rows[11].id if len(rows) > 12 else None}


def owned_blog(blog_id, user, db):
    blog = db.get(Blog, blog_id)
    if not blog or blog.author_id != user.id:
        raise HTTPException(404, 'Story not found.')
    return blog


@router.get('/blogs/{blog_id}/edit')
def edit_blog(blog_id: int, user=Depends(account), db: Session = Depends(get_db)):
    return blog_data(owned_blog(blog_id, user, db), user, db.get(PublicProfile, user.id), True)


@router.get('/blogs/{blog_id}')
def read_blog(blog_id: int, db: Session = Depends(get_db)):
    row = public_blogs(db).filter(Blog.id == blog_id, Blog.status.in_(['published', 'unlisted'])).first()
    if not row:
        raise HTTPException(404, 'This story is private or unavailable.')
    return blog_data(*row, full=True)


@router.post('/blogs', status_code=201)
def create_blog(user=Depends(account), db: Session = Depends(get_db)):
    limit(user, 'create', 10)
    blog = Blog(author_id=user.id)
    db.add(blog)
    db.commit()
    db.refresh(blog)
    return blog_data(blog, user, db.get(PublicProfile, user.id), True)


class BlogInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(max_length=160)
    subtitle: str = Field(max_length=300)
    body: str = Field(max_length=50000)
    place_id: int | None = None
    status: Literal['draft', 'published', 'unlisted', 'archived']
    version: int = Field(ge=1)


@router.patch('/blogs/{blog_id}')
def update_blog(blog_id: int, data: BlogInput, user=Depends(account), db: Session = Depends(get_db)):
    limit(user, 'edit', 120)
    blog = owned_blog(blog_id, user, db)
    profile = db.get(PublicProfile, user.id)
    if data.place_id is not None and data.place_id not in BY_ID:
        raise HTTPException(422, 'Choose a destination from Wanderer.')
    if data.status in ('published', 'unlisted'):
        if not profile or not profile.is_public:
            raise HTTPException(422, 'Make your community profile public before sharing a story.')
        if not data.title.strip() or not data.body.strip() or data.place_id is None:
            raise HTTPException(422, 'Add a title, destination, and story before publishing.')
    values = data.model_dump(exclude={'version'})
    values.update(title=data.title.strip(), version=data.version + 1, updated_at=datetime.now(timezone.utc).replace(tzinfo=None))
    changed = db.query(Blog).filter(Blog.id == blog_id, Blog.version == data.version).update(values, synchronize_session=False)
    if not changed:
        db.rollback()
        raise HTTPException(409, 'This story changed in another tab. Copy your writing before reloading.')
    db.commit()
    db.refresh(blog)
    return blog_data(blog, user, profile, True)


@router.delete('/blogs/{blog_id}')
def delete_blog(blog_id: int, user=Depends(account), db: Session = Depends(get_db)):
    blog = owned_blog(blog_id, user, db)
    db.query(BlogReport).filter(BlogReport.blog_id == blog_id).delete()
    db.delete(blog)
    db.commit()
    return {'deleted': True}


class ReportInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reason: Literal['Spam', 'Harassment', 'Misleading travel information', 'Unsafe advice', 'Copyright concern', 'Other']
    detail: str = Field(default='', max_length=1000)


@router.post('/blogs/{blog_id}/report')
def report_blog(blog_id: int, data: ReportInput, user=Depends(account), db: Session = Depends(get_db)):
    limit(user, 'report', 10)
    read_blog(blog_id, db)
    db.add(BlogReport(user_id=user.id, blog_id=blog_id, **data.model_dump()))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'You have already reported this story.')
    return {'reported': True}


def moderator(user=Depends(account)):
    if user.role not in ('ADMIN', 'MODERATOR'):
        raise HTTPException(403, 'Moderator access required.')
    return user


@router.get('/community/reports')
def reports(before: int | None = Query(None, gt=0), user=Depends(moderator), db: Session = Depends(get_db)):
    query = db.query(BlogReport)
    if before:
        query = query.filter(BlogReport.id < before)
    rows = query.order_by(BlogReport.id.desc()).limit(20).all()
    return [{'id': row.id, 'blog_id': row.blog_id, 'reason': row.reason, 'detail': row.detail} for row in rows]


class ModerationInput(BaseModel):
    hidden: bool


@router.patch('/community/blogs/{blog_id}')
def moderate(blog_id: int, data: ModerationInput, user=Depends(moderator), db: Session = Depends(get_db)):
    blog = db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(404, 'Story not found.')
    blog.hidden = data.hidden
    db.commit()
    return {'hidden': blog.hidden}
