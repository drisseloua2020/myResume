from __future__ import annotations
from collections.abc import Callable
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.enums import RoleEnum
from app.core.security import TokenPayload, decode_token
from app.db.session import get_db
from app.models.entities import User

def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization.removeprefix("Bearer ").strip()

def get_current_token_payload(authorization: str | None = Header(default=None)) -> TokenPayload:
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    try:
        return decode_token(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

def get_optional_token_payload(authorization: str | None = Header(default=None)) -> TokenPayload | None:
    token = _extract_bearer_token(authorization)
    if not token:
        return None
    try:
        return decode_token(token)
    except jwt.PyJWTError:
        return None

def get_current_user(payload: TokenPayload = Depends(get_current_token_payload), db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.id == payload.user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

def require_roles(roles: set[RoleEnum]) -> Callable[..., User]:
    def _require(current_user: User = Depends(get_current_user)) -> User:
        if RoleEnum(current_user.role) not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return current_user
    return _require
