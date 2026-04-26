from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import Field
from app.schemas.base import StrictModel
class CreateResumeIn(StrictModel):
    templateId: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    content: dict[str, Any] | list[Any] | str | int | float | bool | None
class UpdateResumeIn(StrictModel):
    templateId: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: dict[str, Any] | list[Any] | str | int | float | bool | None = None
class DraftIn(StrictModel):
    templateId: str | None = Field(default=None, max_length=80)
    content: dict[str, Any] | list[Any] | str | int | float | bool | None
class ResumeSummaryOut(StrictModel):
    id: str
    templateId: str
    title: str
    createdAt: datetime
    updatedAt: datetime
    userId: str | None = None
    userEmail: str | None = None
    userName: str | None = None
class ResumeOut(StrictModel):
    id: str
    templateId: str
    title: str
    content: dict[str, Any] | list[Any] | str | int | float | bool | None
    createdAt: datetime
    updatedAt: datetime
class ResumeEnvelope(StrictModel):
    resume: ResumeOut
class ResumesEnvelope(StrictModel):
    resumes: list[ResumeSummaryOut]
class ResumeDraftOut(StrictModel):
    id: str
    templateId: str
    content: dict[str, Any] | list[Any] | str | int | float | bool | None
    createdAt: datetime
    updatedAt: datetime
class ResumeDraftEnvelope(StrictModel):
    draft: ResumeDraftOut | None
