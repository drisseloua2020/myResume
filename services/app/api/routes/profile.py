from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.api.routes.common import to_data_source_out, to_profile_sync_update_out
from app.models.entities import DataSource, ProfileSyncUpdate, User
from app.schemas.agent import DataSourcesEnvelope
from app.schemas.profile import ProfileSyncUpdatesEnvelope, SyncIn
from app.services.profile_sync import ensure_default_sources, generate_profile_sync_updates, normalize_source_key
router = APIRouter(prefix="/profile", tags=["profile"])
@router.get("/updates", response_model=ProfileSyncUpdatesEnvelope)
def list_updates(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileSyncUpdatesEnvelope:
    ensure_default_sources(db, current_user.id); db.commit(); rows = db.scalars(select(ProfileSyncUpdate).where(ProfileSyncUpdate.user_id == current_user.id).order_by(desc(ProfileSyncUpdate.created_at)).limit(200)).all(); return ProfileSyncUpdatesEnvelope(updates=[to_profile_sync_update_out(item) for item in rows])
@router.get("/sources", response_model=DataSourcesEnvelope)
def list_sources(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DataSourcesEnvelope:
    ensure_default_sources(db, current_user.id); db.commit(); rows = db.scalars(select(DataSource).where(DataSource.user_id == current_user.id).order_by(DataSource.name.asc())).all(); return DataSourcesEnvelope(sources=[to_data_source_out(item) for item in rows])
@router.post("/sources/{source}/connect", response_model=DataSourcesEnvelope)
def connect_source(source: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DataSourcesEnvelope:
    ensure_default_sources(db, current_user.id); source_name = normalize_source_key(source)
    if not source_name: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown source")
    row = db.scalar(select(DataSource).where(DataSource.user_id == current_user.id, DataSource.name == source_name))
    if not row: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    row.is_connected = True; row.last_sync = row.last_sync or datetime.now(timezone.utc); db.commit(); rows = db.scalars(select(DataSource).where(DataSource.user_id == current_user.id).order_by(DataSource.name.asc())).all(); return DataSourcesEnvelope(sources=[to_data_source_out(item) for item in rows])
@router.post("/sync", response_model=ProfileSyncUpdatesEnvelope)
def sync_profile(payload: SyncIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileSyncUpdatesEnvelope:
    generate_profile_sync_updates(db, current_user.id, providers=payload.providers); db.commit(); rows = db.scalars(select(ProfileSyncUpdate).where(ProfileSyncUpdate.user_id == current_user.id).order_by(desc(ProfileSyncUpdate.created_at)).limit(50)).all(); return ProfileSyncUpdatesEnvelope(updates=[to_profile_sync_update_out(item) for item in rows])
