from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import Field
from app.schemas.base import StrictModel
class DataSourceOut(StrictModel):
    id: str
    name: str
    icon: str
    isConnected: bool
    lastSync: datetime | None = None
class DataSourcesEnvelope(StrictModel):
    sources: list[DataSourceOut]
class DataSourceEnvelope(StrictModel):
    source: DataSourceOut
class AgentUpdateOut(StrictModel):
    id: str
    source: str
    type: str
    title: str
    description: str
    dateFound: datetime | None = None
    status: str
    userId: str | None = None
    userEmail: str | None = None
    userName: str | None = None
class AgentUpdatesEnvelope(StrictModel):
    updates: list[AgentUpdateOut]
class GenerateResumeIn(StrictModel):
    mode: str = Field(pattern="^(MODE_A|MODE_B)$")
    input: dict[str, Any]
class GenerateResumeOut(StrictModel):
    text: str
