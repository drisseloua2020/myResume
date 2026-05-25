from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field, model_validator

from app.schemas.base import StrictModel


class GenerateCoverLetterIn(StrictModel):
    templateId: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    jobDescription: str | None = Field(default=None, max_length=20000)
    jobUrl: str | None = Field(default=None, min_length=8, max_length=2000)
    resumeJson: dict[str, Any] | list[Any] | str | int | float | bool | None = None

    @model_validator(mode="after")
    def require_job_source(self) -> "GenerateCoverLetterIn":
        if not (self.jobDescription or "").strip() and not (self.jobUrl or "").strip():
            raise ValueError("Provide either a job description or a job posting URL.")
        return self


class GeneratedCoverLetterContent(StrictModel):
    coverLetterFull: str
    coverLetterShort: str
    coldEmail: str


class CoverLetterOut(StrictModel):
    id: str
    templateId: str | None = None
    title: str
    jobDescription: str
    jobUrl: str | None = None
    content: GeneratedCoverLetterContent | dict[str, Any] | list[Any] | str | int | float | bool | None = None
    createdAt: datetime | None = None


class CoverLetterEnvelope(StrictModel):
    coverLetter: CoverLetterOut


class CoverLettersEnvelope(StrictModel):
    coverLetters: list[CoverLetterOut]
