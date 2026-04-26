from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.entities import AgentUpdate, DataSource, OAuthAccount, ProfileSyncUpdate
from app.services.activity import new_prefixed_id
DEFAULT_SOURCES = [
    {"name": "LinkedIn", "icon": "linkedin", "is_connected": True},
    {"name": "GitHub", "icon": "github", "is_connected": True},
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
def create_mock_agent_updates(db: Session, user_id: str) -> None:
    connected = db.scalars(select(DataSource).where(DataSource.user_id == user_id, DataSource.is_connected.is_(True))).all()
    connected_names = {item.name for item in connected}
    if not connected_names:
        return
    now = datetime.now(timezone.utc)
    mock = [
        {"source": "GitHub", "type": "Project", "title": 'New Repository: "AI-Finance-Tracker"', "description": 'Found a new public repository with Python and React code. Suggest adding to "Projects" section.'},
        {"source": "LinkedIn", "type": "Certification", "title": "AWS Certified Solutions Architect", "description": "Detected a new license/certification added to your LinkedIn profile."},
    ]
    for item in mock:
        if item["source"] not in connected_names:
            continue
        exists = db.scalar(select(AgentUpdate).where(AgentUpdate.user_id == user_id, AgentUpdate.source == item["source"], AgentUpdate.title == item["title"]))
        if exists:
            continue
        db.add(AgentUpdate(id=new_prefixed_id("upd"), user_id=user_id, source=item["source"], type=item["type"], title=item["title"], description=item["description"], date_found=now, status="pending"))
    db.flush()
def generate_profile_sync_updates(db: Session, user_id: str, providers: list[str] | None = None) -> list[ProfileSyncUpdate]:
    ensure_default_sources(db, user_id)
    provider_filter = {value.lower() for value in (providers or [])}
    sources = db.scalars(select(DataSource).where(DataSource.user_id == user_id)).all()
    oauth_accounts = db.scalars(select(OAuthAccount).where(OAuthAccount.user_id == user_id)).all()
    connected_names = {item.name.lower() for item in sources if item.is_connected}
    connected_names.update(item.provider.lower() for item in oauth_accounts)
    effective = [name for name in connected_names if not provider_filter or name in provider_filter]
    if not effective:
        return []
    candidates = [
        {"source": "LinkedIn", "category": "Certification", "title": "New certification detected", "details": "A new certification was added to your LinkedIn profile.", "payload": {"kind": "certification", "example": "AWS Solutions Architect"}},
        {"source": "GitHub", "category": "Project", "title": "New repository activity", "details": "Recent repository activity suggests a new project worth adding.", "payload": {"kind": "repo", "example": "resume-builder-ai"}},
        {"source": "Microsoft", "category": "Education", "title": "New course completion", "details": "Detected a completed course or learning path.", "payload": {"kind": "course", "example": "Azure Fundamentals"}},
        {"source": "Google", "category": "Experience", "title": "New achievement", "details": "Detected a new achievement that can improve your resume impact section.", "payload": {"kind": "achievement"}},
    ]
    inserted = []
    for item in candidates:
        if item["source"].lower() not in effective:
            continue
        update = ProfileSyncUpdate(id=new_prefixed_id("psu"), user_id=user_id, source=item["source"], category=item["category"], title=item["title"], details=item["details"], payload=item["payload"])
        db.add(update); inserted.append(update)
    for source in sources:
        if source.name.lower() in effective and source.is_connected:
            source.last_sync = datetime.now(timezone.utc)
    db.flush(); return inserted
