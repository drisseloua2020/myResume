from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import Field
from app.schemas.base import StrictModel
class GenerateCoverLetterIn(StrictModel):
    templateId: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    jobDescription: str = Field(min_length=20, max_length=20000)
    resumeJson: dict[str, Any] | list[Any] | str | int | float | bool | None = None
class GeneratedCoverLetterContent(StrictModel):
    coverLetterFull: str
    coverLetterShort: str
    coldEmail: str
class CoverLetterOut(StrictModel):
    id: str
    templateId: str | None = None
    title: str
    jobDescription: str
    content: GeneratedCoverLetterContent | dict[str, Any] | list[Any] | str | int | float | bool | None = None
    createdAt: datetime | None = None
class CoverLetterEnvelope(StrictModel):
    coverLetter: CoverLetterOut
class CoverLettersEnvelope(StrictModel):
    coverLetters: list[CoverLetterOut]
