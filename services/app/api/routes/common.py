from __future__ import annotations
from decimal import Decimal
from app.schemas.agent import AgentUpdateOut, DataSourceOut
from app.schemas.auth import ActivityLogOut, UserOut
from app.schemas.cover_letters import CoverLetterOut, GeneratedCoverLetterContent
from app.schemas.profile import ProfileSourceOut, ProfileSyncUpdateOut
from app.schemas.resumes import ResumeDraftOut, ResumeOut, ResumeSummaryOut

def format_paid_amount(value: Decimal | float | int | str | None) -> str:
    if isinstance(value, Decimal): amount = value
    elif isinstance(value, str): amount = Decimal(value.replace("$", "") or "0")
    else: amount = Decimal(str(value or 0))
    return f"${amount:.2f}"

def to_user_out(user) -> UserOut:
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role, plan=user.plan, status=user.status, createdAt=user.created_at, paidAmount=format_paid_amount(user.paid_amount), authProvider=user.auth_provider)

def to_activity_log_out(log) -> ActivityLogOut:
    return ActivityLogOut(id=log.id, userId=log.user_id, userName=log.user_name, action=log.action, details=log.details, timestamp=log.timestamp)

def to_data_source_out(source) -> DataSourceOut:
    return DataSourceOut(id=source.id, name=source.name, icon=source.icon, isConnected=source.is_connected, lastSync=source.last_sync)

def to_agent_update_out(update, *, user=None) -> AgentUpdateOut:
    return AgentUpdateOut(id=update.id, source=update.source, type=update.type, title=update.title, description=update.description, dateFound=update.date_found, status=update.status, userId=getattr(update, "user_id", None), userEmail=getattr(user, "email", None) if user else None, userName=getattr(user, "name", None) if user else None)

def to_resume_summary_out(resume, *, user=None) -> ResumeSummaryOut:
    return ResumeSummaryOut(id=resume.id, templateId=resume.template_id, title=resume.title, createdAt=resume.created_at, updatedAt=resume.updated_at, userId=getattr(resume, "user_id", None), userEmail=getattr(user, "email", None) if user else None, userName=getattr(user, "name", None) if user else None)

def to_resume_out(resume) -> ResumeOut:
    return ResumeOut(id=resume.id, templateId=resume.template_id, title=resume.title, content=resume.content, createdAt=resume.created_at, updatedAt=resume.updated_at)

def to_resume_draft_out(draft) -> ResumeDraftOut:
    return ResumeDraftOut(id=draft.id, templateId=draft.template_id, content=draft.content, createdAt=draft.created_at, updatedAt=draft.updated_at)

def to_cover_letter_out(cover_letter) -> CoverLetterOut:
    content = cover_letter.content
    if isinstance(content, dict) and {"coverLetterFull", "coverLetterShort", "coldEmail"}.issubset(content.keys()):
        typed = GeneratedCoverLetterContent(coverLetterFull=str(content.get("coverLetterFull", "")), coverLetterShort=str(content.get("coverLetterShort", "")), coldEmail=str(content.get("coldEmail", "")))
    else:
        typed = content
    return CoverLetterOut(id=cover_letter.id, templateId=cover_letter.template_id, title=cover_letter.title, jobDescription=cover_letter.job_description, content=typed, createdAt=cover_letter.created_at)

def to_profile_sync_update_out(update) -> ProfileSyncUpdateOut:
    return ProfileSyncUpdateOut(id=update.id, source=update.source, category=update.category, title=update.title, details=update.details, payload=update.payload, createdAt=update.created_at)

def to_profile_source_out(source) -> ProfileSourceOut:
    return ProfileSourceOut(id=source.id, name=source.name, icon=source.icon, oauthProvider=source.oauth_provider, isEnabled=source.is_enabled, createdAt=source.created_at)
