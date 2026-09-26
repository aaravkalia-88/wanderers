from datetime import timedelta
from hashlib import sha256
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.core.cache import rate_limit_check, cache_invalidate_prefix, cache_delete
from app.models.user import User

router = APIRouter()


@router.post("/login/access-token")
def login_access_token(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    # Separate shared-network traffic from repeated attempts on one account.
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limit_check(f"login-ip:{client_ip}", max_attempts=60, window_seconds=60):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait a minute and try again.",
        )

    if len(form_data.username) > 200 or len(form_data.password) > 1024:
        raise HTTPException(401, "Incorrect email or password")
    email = form_data.username.strip().lower()
    account_key = "login-account:" + sha256(email.encode()).hexdigest()
    if not rate_limit_check(account_key, max_attempts=5, window_seconds=60):
        raise HTTPException(429, "Too many login attempts. Please wait a minute and try again.")
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been deactivated",
        )

    cache_delete("rate:" + account_key)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


from uuid import uuid4
from pydantic import BaseModel, Field, field_validator
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from app.core.security import get_password_hash
from sqlalchemy.exc import IntegrityError

bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please sign in to access your passport.",
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require_exp": True, "require_sub": True},
        )
        user = db.get(User, int(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This account is no longer active. Please contact support.",
            )
        return user
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
        )
    except (JWTError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please sign in again.",
        )


@router.post("/guest")
def guest(request: Request, db: Session = Depends(get_db)):
    # Rate limit: 10 guest sessions per minute per IP
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limit_check(f"guest:{client_ip}", max_attempts=10, window_seconds=60):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment and try again.",
        )

    identity = uuid4().hex
    user = User(
        username="Wanderer-" + identity[:8],
        email=identity + "@guest.local",
        password_hash="!",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


class Registration(BaseModel):
    username: str = Field(
        min_length=2, max_length=40, pattern=r"^[a-zA-Z0-9_ -]+$"
    )
    email: str = Field(
        min_length=5, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )
    password: str = Field(min_length=8, max_length=64)

    @field_validator("username", "email", mode="before")
    @classmethod
    def trim_identity(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def account_email(cls, value):
        value = value.lower()
        if value.endswith("@guest.local"):
            raise ValueError("Use your own email address; guest.local is reserved")
        return value


@router.post("/register")
def register(
    request: Request,
    data: Registration,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    # Rate limit: 3 registration attempts per minute per IP
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limit_check(
        f"register:{client_ip}", max_attempts=3, window_seconds=60
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many registration attempts. Please wait a minute.",
        )

    if user.password_hash != "!":
        raise HTTPException(400, "This passport already has an account")
    user.username = data.username
    user.email = data.email
    user.password_hash = get_password_hash(data.password)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "That email or username is already registered")
    cache_invalidate_prefix(f"passport:{user.id}")
    return {"username": user.username}
