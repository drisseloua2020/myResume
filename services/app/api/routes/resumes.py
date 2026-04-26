from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.api.routes.common import to_resume_draft_out, to_resume_out, to_resume_summary_out
from app.models.entities import Resume, ResumeDraft, User
from app.schemas.common import IdResponse, OkResponse
from app.schemas.resumes import CreateResumeIn, DraftIn, ResumeDraftEnvelope, ResumeEnvelope, ResumesEnvelope, UpdateResumeIn
from app.services.activity import log_activity, new_prefixed_id
router = APIRouter(prefix="/resumes", tags=["resumes"])
@router.post("/", response_model=IdResponse, status_code=status.HTTP_201_CREATED)
def create_resume(payload: CreateResumeIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> IdResponse:
    resume = Resume(id=new_prefixed_id("res"), user_id=current_user.id, template_id=payload.templateId, title=payload.title, content=payload.content)
    db.add(resume); db.flush(); log_activity(db, current_user.id, "RESUME_SAVE", details=f"Template: {payload.templateId}", user_name=current_user.name); db.commit(); return IdResponse(id=resume.id)
@router.get("/", response_model=ResumesEnvelope)
def list_resumes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ResumesEnvelope:
    rows = db.scalars(select(Resume).where(Resume.user_id == current_user.id).order_by(desc(Resume.updated_at))).all(); return ResumesEnvelope(resumes=[to_resume_summary_out(item) for item in rows])
@router.post("/draft", response_model=OkResponse)
def save_draft(payload: DraftIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    template_id = payload.templateId or ""
    draft = db.scalar(select(ResumeDraft).where(ResumeDraft.user_id == current_user.id, ResumeDraft.template_id == template_id))
    if draft: draft.content = payload.content
    else: db.add(ResumeDraft(id=new_prefixed_id("draft"), user_id=current_user.id, template_id=template_id, content=payload.content))
    db.flush(); log_activity(db, current_user.id, "RESUME_DRAFT_SAVE", details=f"Template: {template_id or 'default'}", user_name=current_user.name); db.commit(); return OkResponse(ok=True)
@router.get("/latest-draft", response_model=ResumeDraftEnvelope)
def latest_draft(templateId: str | None = Query(default=None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ResumeDraftEnvelope:
    stmt = select(ResumeDraft).where(ResumeDraft.user_id == current_user.id)
    if templateId is not None: stmt = stmt.where(ResumeDraft.template_id == templateId)
    draft = db.scalar(stmt.order_by(desc(ResumeDraft.updated_at)).limit(1)); return ResumeDraftEnvelope(draft=to_resume_draft_out(draft) if draft else None)
@router.put("/{resume_id}", response_model=OkResponse)
def update_resume(resume_id: str, payload: UpdateResumeIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    if payload.templateId is None and payload.title is None and payload.content is None: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")
    resume = db.scalar(select(Resume).where(Resume.user_id == current_user.id, Resume.id == resume_id))
    if not resume: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if payload.templateId is not None: resume.template_id = payload.templateId
    if payload.title is not None: resume.title = payload.title
    if payload.content is not None: resume.content = payload.content
    log_activity(db, current_user.id, "RESUME_UPDATE", details=f"Resume: {resume_id}", user_name=current_user.name); db.commit(); return OkResponse(ok=True)
@router.get("/{resume_id}", response_model=ResumeEnvelope)
def get_resume(resume_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ResumeEnvelope:
    resume = db.scalar(select(Resume).where(Resume.user_id == current_user.id, Resume.id == resume_id))
    if not resume: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    log_activity(db, current_user.id, "RESUME_DOWNLOAD", details=f"Resume: {resume_id}", user_name=current_user.name); db.commit(); db.refresh(resume); return ResumeEnvelope(resume=to_resume_out(resume))
@router.delete("/{resume_id}", response_model=OkResponse)
def delete_resume(resume_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    resume = db.scalar(select(Resume).where(Resume.user_id == current_user.id, Resume.id == resume_id))
    if not resume: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(resume); db.commit(); return OkResponse(ok=True)
