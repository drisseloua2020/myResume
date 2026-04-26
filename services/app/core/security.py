from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from app.core.config import settings
from app.core.enums import RoleEnum
password_hasher = PasswordHasher()
@dataclass(frozen=True)
class TokenPayload:
    user_id: str
    email: str
    role: RoleEnum
    name: str | None = None

def parse_expiry(spec: str) -> timedelta:
    raw = (spec or "15m").strip().lower()
    if raw.isdigit():
        return timedelta(seconds=int(raw))
    unit = raw[-1]
    value = raw[:-1]
    if not value.isdigit():
        return timedelta(minutes=15)
    amount = int(value)
    return {"s": timedelta(seconds=amount), "m": timedelta(minutes=amount), "h": timedelta(hours=amount), "d": timedelta(days=amount)}.get(unit, timedelta(minutes=15))

def hash_password(plain: str) -> str:
    return password_hasher.hash(plain)

def verify_password(stored: str | None, plain: str) -> tuple[bool, bool]:
    if not stored:
        return False, False
    trimmed = stored.strip()
    if trimmed.startswith("$argon2"):
        try:
            password_hasher.verify(trimmed, plain)
            return True, False
        except (VerifyMismatchError, InvalidHashError):
            return False, False
    ok = trimmed == plain
    return ok, ok

def sign_token(payload: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    claims = dict(payload)
    claims["exp"] = now + parse_expiry(settings.jwt_expires_in)
    claims["iat"] = now
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")

def decode_token(token: str) -> TokenPayload:
    decoded = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    return TokenPayload(user_id=str(decoded["userId"]), email=str(decoded["email"]), role=RoleEnum(str(decoded["role"])), name=decoded.get("name"))
