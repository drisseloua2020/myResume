from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.base import StrictModel

CareerStatus = Literal["saved", "applied", "interview", "offer", "rejected"]


class AnalyzeCareerIn(StrictModel):
    resumeJson: dict[str, Any] = Field(default_factory=dict)
    jobDescription: str = Field(default="", max_length=50000)
    jobUrl: str | None = Field(default=None, max_length=2000)
    targetCountry: str | None = Field(default="US", max_length=40)
    targetLanguage: str | None = Field(default="en", max_length=40)


class AnalyzeCareerOut(StrictModel):
    report: dict[str, Any]


class ExportResumeIn(StrictModel):
    resumeJson: dict[str, Any] = Field(default_factory=dict)
    title: str | None = Field(default="resume", max_length=200)
    publicProfileUrl: str | None = Field(default=None, max_length=2000)
    redactPii: bool = False


class ExportResumeOut(StrictModel):
    exports: dict[str, Any]


class LinkedInImportIn(StrictModel):
    profileText: str = Field(min_length=1, max_length=50000)


class LinkedInImportOut(StrictModel):
    resume: dict[str, Any]
    checklist: list[dict[str, Any]]
    warnings: list[str]


class CreateJobApplicationIn(StrictModel):
    status: CareerStatus = "saved"
    title: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    jobUrl: str | None = Field(default=None, max_length=2000)
    jobDescription: str = Field(default="", max_length=50000)
    location: str | None = Field(default=None, max_length=200)
    salary: str | None = Field(default=None, max_length=120)
    contactName: str | None = Field(default=None, max_length=160)
    contactEmail: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=20000)
    deadline: str | None = Field(default=None, max_length=40)
    resumeId: str | None = Field(default=None, max_length=64)
    coverLetterId: str | None = Field(default=None, max_length=64)
    packet: dict[str, Any] | None = None
    reminders: list[dict[str, Any]] | None = None
    savedAnswers: list[dict[str, Any]] | None = None


class UpdateJobApplicationIn(StrictModel):
    status: CareerStatus | None = None
    title: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    jobUrl: str | None = Field(default=None, max_length=2000)
    jobDescription: str | None = Field(default=None, max_length=50000)
    location: str | None = Field(default=None, max_length=200)
    salary: str | None = Field(default=None, max_length=120)
    contactName: str | None = Field(default=None, max_length=160)
    contactEmail: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=20000)
    deadline: str | None = Field(default=None, max_length=40)
    resumeId: str | None = Field(default=None, max_length=64)
    coverLetterId: str | None = Field(default=None, max_length=64)
    packet: dict[str, Any] | None = None
    reminders: list[dict[str, Any]] | None = None
    savedAnswers: list[dict[str, Any]] | None = None


class JobApplicationOut(StrictModel):
    id: str
    status: str
    title: str
    company: str | None
    jobUrl: str | None
    jobDescription: str
    location: str | None
    salary: str | None
    contactName: str | None
    contactEmail: str | None
    notes: str | None
    deadline: str | None
    resumeId: str | None
    coverLetterId: str | None
    packet: dict[str, Any] | list[Any] | str | int | float | bool | None
    reminders: dict[str, Any] | list[Any] | str | int | float | bool | None
    savedAnswers: dict[str, Any] | list[Any] | str | int | float | bool | None
    createdAt: datetime
    updatedAt: datetime


class JobApplicationsEnvelope(StrictModel):
    jobs: list[JobApplicationOut]


class JobApplicationEnvelope(StrictModel):
    job: JobApplicationOut


class CreateAchievementIn(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    category: str = Field(default="General", max_length=80)
    content: str = Field(min_length=1, max_length=5000)
    tags: list[str] | None = None
    metrics: str | None = Field(default=None, max_length=255)
    sourceResumeId: str | None = Field(default=None, max_length=64)


class AchievementOut(StrictModel):
    id: str
    title: str
    category: str
    content: str
    tags: dict[str, Any] | list[Any] | str | int | float | bool | None
    metrics: str | None
    sourceResumeId: str | None
    createdAt: datetime


class AchievementsEnvelope(StrictModel):
    achievements: list[AchievementOut]


class CreateResumeVersionIn(StrictModel):
    resumeId: str | None = Field(default=None, max_length=64)
    jobApplicationId: str | None = Field(default=None, max_length=64)
    kind: str = Field(default="base", max_length=40)
    title: str = Field(min_length=1, max_length=200)
    locale: str | None = Field(default=None, max_length=40)
    content: dict[str, Any] = Field(default_factory=dict)
    changeSummary: str | None = Field(default=None, max_length=2000)


class ResumeVersionOut(StrictModel):
    id: str
    resumeId: str | None
    jobApplicationId: str | None
    kind: str
    title: str
    locale: str | None
    content: dict[str, Any] | list[Any] | str | int | float | bool | None
    changeSummary: str | None
    createdAt: datetime


class ResumeVersionsEnvelope(StrictModel):
    versions: list[ResumeVersionOut]


class CreateResumeShareIn(StrictModel):
    resumeId: str = Field(min_length=1, max_length=64)
    isPublic: bool = False
    redactPii: bool = True
    metadata: dict[str, Any] | None = None


class ResumeShareOut(StrictModel):
    id: str
    resumeId: str
    slug: str
    isPublic: bool
    redactPii: bool
    metadata: dict[str, Any] | list[Any] | str | int | float | bool | None
    createdAt: datetime


class ResumeShareEnvelope(StrictModel):
    share: ResumeShareOut


class CareerAnalyticsOut(StrictModel):
    analytics: dict[str, Any]


class CareerFeatureCatalogOut(StrictModel):
    features: list[dict[str, Any]]
