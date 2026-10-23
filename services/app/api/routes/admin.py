from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select, func, or_
from pydantic import BaseModel
from typing import Literal
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_roles
from app.api.routes.common import to_agent_update_out, to_profile_source_out, to_resume_summary_out, to_activity_log_out, to_user_out
from app.core.enums import RoleEnum
from app.models.entities import ActivityLog, AgentUpdate, ContactMessage, ProfileSourceCatalog, Resume, User
from app.schemas.admin import AdminAgentUpdatesEnvelope, AdminResumesEnvelope, ContactMessageOut, ContactMessagesEnvelope, ReplyIn, TemplatesEnvelope
from app.schemas.auth import ActivityLogsEnvelope, UsersEnvelope
from app.schemas.profile import CreateProfileSourceIn, ProfileSourcesEnvelope
from app.schemas.common import OkResponse
from app.services.activity import log_activity, new_prefixed_id
from app.services.mailer import send_support_email
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_roles({RoleEnum.admin}))])

@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    from app.models.entities import JobApplication, CoverLetter
    return {"users": db.scalar(select(func.count()).select_from(User)),
            "resumes": db.scalar(select(func.count()).select_from(Resume)),
            "coverLetters": db.scalar(select(func.count()).select_from(CoverLetter)),
            "jobs": db.scalar(select(func.count()).select_from(JobApplication)),
            "openSupport": db.scalar(select(func.count()).select_from(ContactMessage).where(ContactMessage.status == "new")),
            "externalSubmission": False, "profileSync": False, "billing": False}

class UserStatusIn(BaseModel):
    status: Literal["Active", "Canceled"]

@router.patch("/users/{user_id}/status")
def change_user_status(user_id: str, payload: UserStatusIn, admin: User = Depends(require_roles({RoleEnum.admin})), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id or user.role == "admin":
        raise HTTPException(409, "Admin accounts cannot be deactivated here")
    user.status = payload.status
    user.token_version += 1
    log_activity(db, admin.id, "ADMIN_USER_STATUS", details=f"User: {user.id}; status: {payload.status}", user_name=admin.name)
    db.commit()
    return {"user": to_user_out(user)}
import json
from pathlib import Path
TEMPLATE_CATALOG = json.loads((Path(__file__).resolve().parents[2] / "template_catalog.json").read_text(encoding="utf-8"))
@router.get("/users", response_model=UsersEnvelope)
def users(q: str = Query(default="", max_length=200), offset: int = Query(default=0, ge=0), limit: int = Query(default=1000, ge=1, le=1000), db: Session = Depends(get_db)):
    query = select(User)
    if q.strip():
        query = query.where(or_(User.name.ilike(f"%{q.strip()}%"), User.email.ilike(f"%{q.strip()}%"), User.status.ilike(f"%{q.strip()}%")))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(desc(User.created_at), User.id).offset(offset).limit(limit)).all()
    return UsersEnvelope(users=[to_user_out(item) for item in rows], total=total)
@router.get("/activity-logs", response_model=ActivityLogsEnvelope)
def activity_logs(q: str = Query(default="", max_length=200), userId: str | None = Query(default=None, max_length=100), offset: int = Query(default=0, ge=0), limit: int = Query(default=2000, ge=1, le=2000), db: Session = Depends(get_db)):
    query = select(ActivityLog)
    if userId:
        query = query.where(ActivityLog.user_id == userId)
    if q.strip():
        query = query.where(or_(ActivityLog.user_name.ilike(f"%{q.strip()}%"), ActivityLog.action.ilike(f"%{q.strip()}%"), ActivityLog.details.ilike(f"%{q.strip()}%")))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(desc(ActivityLog.timestamp), ActivityLog.id).offset(offset).limit(limit)).all()
    return ActivityLogsEnvelope(logs=[to_activity_log_out(item) for item in rows], total=total)
@router.get("/templates", response_model=TemplatesEnvelope)
def templates() -> TemplatesEnvelope:
    return TemplatesEnvelope(templates=TEMPLATE_CATALOG)
@router.get("/profile-sources", response_model=ProfileSourcesEnvelope)
def profile_sources(db: Session = Depends(get_db)) -> ProfileSourcesEnvelope:
    rows = db.scalars(select(ProfileSourceCatalog).order_by(desc(ProfileSourceCatalog.created_at))).all(); return ProfileSourcesEnvelope(sources=[to_profile_source_out(item) for item in rows])
@router.post("/profile-sources", response_model=ProfileSourcesEnvelope, status_code=status.HTTP_201_CREATED)
def create_profile_source(payload: CreateProfileSourceIn, db: Session = Depends(get_db)) -> ProfileSourcesEnvelope:
    existing = db.scalar(select(ProfileSourceCatalog).where(ProfileSourceCatalog.name == payload.name.strip()))
    if not existing: db.add(ProfileSourceCatalog(id=new_prefixed_id("psc"), name=payload.name.strip(), icon=payload.icon.strip(), oauth_provider=payload.oauthProvider, is_enabled=True)); db.commit()
    rows = db.scalars(select(ProfileSourceCatalog).order_by(desc(ProfileSourceCatalog.created_at))).all(); return ProfileSourcesEnvelope(sources=[to_profile_source_out(item) for item in rows])
@router.patch("/profile-sources/{source_id}/toggle", response_model=ProfileSourcesEnvelope)
def toggle_profile_source(source_id: str, db: Session = Depends(get_db)) -> ProfileSourcesEnvelope:
    current = db.scalar(select(ProfileSourceCatalog).where(ProfileSourceCatalog.id == source_id))
    if not current: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    current.is_enabled = not current.is_enabled; db.commit(); rows = db.scalars(select(ProfileSourceCatalog).order_by(desc(ProfileSourceCatalog.created_at))).all(); return ProfileSourcesEnvelope(sources=[to_profile_source_out(item) for item in rows])
@router.get("/contact-messages", response_model=ContactMessagesEnvelope)
def contact_messages(db: Session = Depends(get_db)) -> ContactMessagesEnvelope:
    rows = db.scalars(select(ContactMessage).order_by(desc(ContactMessage.created_at)).limit(500)).all(); return ContactMessagesEnvelope(messages=[ContactMessageOut(id=item.id, userId=item.user_id, name=item.name, email=item.email, subject=item.subject, message=item.message, status=item.status, createdAt=item.created_at) for item in rows])
@router.post("/contact-messages/{message_id}/reply", response_model=OkResponse)
def reply(message_id: str, payload: ReplyIn, admin: User = Depends(require_roles({RoleEnum.admin})), db: Session = Depends(get_db)) -> OkResponse:
    row = db.scalar(select(ContactMessage).where(ContactMessage.id == message_id))
    if not row: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    try:
        send_support_email(to=row.email, subject=payload.subject, text=payload.message); row.status = "replied"; log_activity(db, admin.id, "contact_reply", details=f"contactMessageId={message_id};to={row.email};subject={payload.subject}", user_name=admin.name); db.commit(); return OkResponse(ok=True)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Support email delivery failed. Check SMTP configuration and retry.") from exc
@router.get("/resumes", response_model=AdminResumesEnvelope)
def resumes(db: Session = Depends(get_db)) -> AdminResumesEnvelope:
    rows = db.scalars(select(Resume).order_by(desc(Resume.created_at)).limit(500)).all(); users_by_id = {user.id: user for user in db.scalars(select(User)).all()}; return AdminResumesEnvelope(resumes=[to_resume_summary_out(item, user=users_by_id.get(item.user_id)) for item in rows])
@router.get("/agent-updates", response_model=AdminAgentUpdatesEnvelope)
def agent_updates(db: Session = Depends(get_db)) -> AdminAgentUpdatesEnvelope:
    rows = db.scalars(select(AgentUpdate).order_by(desc(AgentUpdate.date_found)).limit(500)).all(); users_by_id = {user.id: user for user in db.scalars(select(User)).all()}; return AdminAgentUpdatesEnvelope(updates=[to_agent_update_out(item, user=users_by_id.get(item.user_id)) for item in rows])
