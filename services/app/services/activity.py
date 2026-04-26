from __future__ import annotations
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.entities import ActivityLog, User

def new_prefixed_id(prefix: str) -> str:
    return f"{prefix}-{uuid4()}"

def get_user_name(db: Session, user_id: str, fallback: str | None = None) -> str:
    user = db.scalar(select(User).where(User.id == user_id))
    return user.name if user and user.name else (fallback or "Unknown User")

def log_activity(db: Session, user_id: str, action: str, details: str | None = None, user_name: str | None = None) -> ActivityLog:
    entry = ActivityLog(id=new_prefixed_id("log"), user_id=user_id, user_name=get_user_name(db, user_id, fallback=user_name), action=action, details=details)
    db.add(entry); db.flush(); return entry
