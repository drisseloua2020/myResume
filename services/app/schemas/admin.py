from __future__ import annotations
from datetime import datetime
from pydantic import Field
from app.schemas.base import StrictModel
from app.schemas.agent import AgentUpdateOut
from app.schemas.profile import ProfileSourceOut
from app.schemas.resumes import ResumeSummaryOut
class ReplyIn(StrictModel):
    subject: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=5000)
class ContactMessageOut(StrictModel):
    id: str
    userId: str | None = None
    name: str
    email: str
    subject: str
    message: str
    status: str
    createdAt: datetime | None = None
class ContactMessagesEnvelope(StrictModel):
    messages: list[ContactMessageOut]
class TemplatesEnvelope(StrictModel):
    templates: list[dict[str, str]]
class AdminAgentUpdatesEnvelope(StrictModel):
    updates: list[AgentUpdateOut]
class AdminResumesEnvelope(StrictModel):
    resumes: list[ResumeSummaryOut]
