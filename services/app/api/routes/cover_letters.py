from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.api.routes.common import to_cover_letter_out
from app.models.entities import CoverLetter, User
from app.prompts import RESUME_FORGE_SYSTEM_PROMPT
from app.schemas.common import OkResponse
from app.schemas.cover_letters import CoverLetterEnvelope, CoverLettersEnvelope, GenerateCoverLetterIn
from app.services.activity import log_activity, new_prefixed_id
from app.services.gemini import get_gemini_client, get_model_name, make_config
router = APIRouter(prefix="/cover-letters", tags=["cover-letters"])
def extract(raw_text: str, start_marker: str, end_marker: str | None) -> str | None:
    start_index = raw_text.find(start_marker)
    if start_index == -1: return None
    start = start_index + len(start_marker)
    end = raw_text.find(end_marker, start) if end_marker else len(raw_text)
    if end == -1: end = len(raw_text)
    return raw_text[start:end].strip()
@router.post("/generate", response_model=CoverLetterEnvelope, status_code=status.HTTP_201_CREATED)
def generate(payload: GenerateCoverLetterIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CoverLetterEnvelope:
    title = (payload.title or "Cover Letter")[:200]
    user_prompt = f"""You are generating ONLY cover letter outputs.

Return EXACTLY these sections (no resume sections):
COVER_LETTER_FULL:
<text>

COVER_LETTER_SHORT:
<text>

COLD_EMAIL:
<text>

USER_CONTEXT_JSON:
{json.dumps({'name': current_user.name, 'email': current_user.email, 'templateId': payload.templateId, 'jobDescription': payload.jobDescription, 'resumeJson': payload.resumeJson}, indent=2)}"""
    client = get_gemini_client(); model = get_model_name()
    try:
        response = client.models.generate_content(model=model, contents=[user_prompt], config=make_config(RESUME_FORGE_SYSTEM_PROMPT))
        raw = response.text or ""
        cover_letter_full = extract(raw, "COVER_LETTER_FULL:", "COVER_LETTER_SHORT:") or raw.strip()
        cover_letter_short = extract(raw, "COVER_LETTER_SHORT:", "COLD_EMAIL:") or ""
        cold_email = extract(raw, "COLD_EMAIL:", None) or ""
        entity = CoverLetter(id=new_prefixed_id("cl"), user_id=current_user.id, template_id=payload.templateId, title=title, job_description=payload.jobDescription, content={"coverLetterFull": cover_letter_full, "coverLetterShort": cover_letter_short, "coldEmail": cold_email, "raw": raw})
        db.add(entity); db.flush(); log_activity(db, current_user.id, "COVERLETTER_GENERATE", details=f"Template: {payload.templateId or 'n/a'}", user_name=current_user.name); db.commit(); db.refresh(entity)
        return CoverLetterEnvelope(coverLetter=to_cover_letter_out(entity))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI generation failed") from exc
@router.get("/", response_model=CoverLettersEnvelope)
def list_cover_letters(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CoverLettersEnvelope:
    rows = db.scalars(select(CoverLetter).where(CoverLetter.user_id == current_user.id).order_by(desc(CoverLetter.created_at))).all(); return CoverLettersEnvelope(coverLetters=[to_cover_letter_out(item) for item in rows])
@router.get("/{cover_letter_id}", response_model=CoverLetterEnvelope)
def get_cover_letter(cover_letter_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CoverLetterEnvelope:
    row = db.scalar(select(CoverLetter).where(CoverLetter.user_id == current_user.id, CoverLetter.id == cover_letter_id))
    if not row: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return CoverLetterEnvelope(coverLetter=to_cover_letter_out(row))
@router.delete("/{cover_letter_id}", response_model=OkResponse)
def delete_cover_letter(cover_letter_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    row = db.scalar(select(CoverLetter).where(CoverLetter.user_id == current_user.id, CoverLetter.id == cover_letter_id))
    if not row: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(row); db.commit(); return OkResponse(ok=True)
