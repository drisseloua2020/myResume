from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import Field
from app.schemas.base import StrictModel
class SyncIn(StrictModel):
    providers: list[str] | None = None
class ProfileSyncUpdateOut(StrictModel):
    id: str
    source: str
    category: str
    title: str
    details: str
    payload: dict[str, Any] | list[Any] | str | int | float | bool | None = None
    createdAt: datetime | None = None
class ProfileSyncUpdatesEnvelope(StrictModel):
    updates: list[ProfileSyncUpdateOut]
class CreateProfileSourceIn(StrictModel):
    name: str = Field(min_length=2, max_length=80)
    icon: str = Field(default="link", min_length=1, max_length=40)
    oauthProvider: str | None = Field(default=None, min_length=2, max_length=40)
class ProfileSourceOut(StrictModel):
    id: str
    name: str
    icon: str
    oauthProvider: str | None = None
    isEnabled: bool
    createdAt: datetime | None = None
class ProfileSourcesEnvelope(StrictModel):
    sources: list[ProfileSourceOut]
