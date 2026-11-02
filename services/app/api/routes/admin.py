from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
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
TEMPLATE_CATALOG = [{"id": "classic_pro", "name": "Classic Professional", "tag": "Conservative"}, {"id": "modern_tech", "name": "Modern Tech", "tag": "Modern"}, {"id": "creative_bold", "name": "Creative Bold", "tag": "Creative"}, {"id": "executive_lead", "name": "Executive Lead", "tag": "Leadership"}, {"id": "minimalist_clean", "name": "Minimalist Clean", "tag": "Simple"}, {"id": "compact_grid", "name": "Compact Grid", "tag": "Technical"}]
@router.get("/users", response_model=UsersEnvelope)
def users(db: Session = Depends(get_db)):
    rows = db.scalars(select(User).order_by(desc(User.created_at)).limit(1000)).all(); return UsersEnvelope(users=[to_user_out(item) for item in rows])
@router.get("/activity-logs", response_model=ActivityLogsEnvelope)
def activity_logs(db: Session = Depends(get_db)):
    rows = db.scalars(select(ActivityLog).order_by(desc(ActivityLog.timestamp)).limit(2000)).all(); return ActivityLogsEnvelope(logs=[to_activity_log_out(item) for item in rows])
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send email: {exc}") from exc
@router.get("/resumes", response_model=AdminResumesEnvelope)
def resumes(db: Session = Depends(get_db)) -> AdminResumesEnvelope:
    rows = db.scalars(select(Resume).order_by(desc(Resume.created_at)).limit(500)).all(); users_by_id = {user.id: user for user in db.scalars(select(User)).all()}; return AdminResumesEnvelope(resumes=[to_resume_summary_out(item, user=users_by_id.get(item.user_id)) for item in rows])
@router.get("/agent-updates", response_model=AdminAgentUpdatesEnvelope)
def agent_updates(db: Session = Depends(get_db)) -> AdminAgentUpdatesEnvelope:
    rows = db.scalars(select(AgentUpdate).order_by(desc(AgentUpdate.date_found)).limit(500)).all(); users_by_id = {user.id: user for user in db.scalars(select(User)).all()}; return AdminAgentUpdatesEnvelope(updates=[to_agent_update_out(item, user=users_by_id.get(item.user_id)) for item in rows])
