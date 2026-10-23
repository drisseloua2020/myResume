from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.entities import DataSource
from app.services.activity import new_prefixed_id
DEFAULT_SOURCES = [
    {"name": "LinkedIn", "icon": "linkedin", "is_connected": False},
    {"name": "GitHub", "icon": "github", "is_connected": False},
    {"name": "University Portal", "icon": "school", "is_connected": False},
]
def normalize_source_key(key: str) -> str | None:
    return {
        "linkedin": "LinkedIn", "github": "GitHub", "university": "University Portal", "universal": "University Portal", "university portal": "University Portal", "google": "Google", "microsoft": "Microsoft"
    }.get((key or "").strip().lower())
def ensure_default_sources(db: Session, user_id: str) -> None:
    existing = db.scalars(select(DataSource).where(DataSource.user_id == user_id)).all()
    names = {item.name.lower() for item in existing}
    created = False
    for source in DEFAULT_SOURCES:
        if source["name"].lower() in names:
            continue
        db.add(DataSource(id=new_prefixed_id("src"), user_id=user_id, name=source["name"], icon=source["icon"], is_connected=source["is_connected"], last_sync=datetime.now(timezone.utc) if source["is_connected"] else None))
        created = True
    if created:
        db.flush()
