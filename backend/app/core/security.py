import hashlib, secrets, hmac
from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
import bcrypt
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or len(plain_password) > 1024:
        return False
    try:
        if hashed_password.startswith("scrypt$"):
            _, salt, expected = hashed_password.split("$")
            actual = hashlib.scrypt(plain_password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
            return hmac.compare_digest(actual, expected)
        if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            # Legacy bcrypt hashes used only the first 72 bytes; new accounts use scrypt.
            return bcrypt.checkpw(plain_password.encode()[:72], hashed_password.encode())
    except (ValueError, TypeError):
        pass
    return False

def get_password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1).hex()
    return "scrypt$" + salt.hex() + "$" + digest

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject), "jti": secrets.token_urlsafe(24)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
