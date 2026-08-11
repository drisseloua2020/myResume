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
class ResumeUploadFileData(StrictModel):
    mimeType: str = Field(min_length=1, max_length=200)
    data: str = Field(min_length=1)
    name: str | None = Field(default=None, max_length=255)
class ParseResumeUploadIn(StrictModel):
    importFormat: str | None = Field(default="ats", max_length=80)
    fileData: ResumeUploadFileData
class ParseResumeUploadOut(StrictModel):
    resume: dict[str, Any]
    warnings: list[str]
    confidence: dict[str, Any]
    document: dict[str, Any]
    atsReport: dict[str, Any]
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
class LatestResumeEnvelope(StrictModel):
    resume: ResumeOut | None
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
