from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.common import to_agent_update_out, to_data_source_out
from app.models.entities import AgentUpdate, DataSource, User
from app.schemas.agent import (
    AgentUpdatesEnvelope,
    DataSourceEnvelope,
    DataSourcesEnvelope,
    GenerateResumeIn,
    GenerateResumeOut,
)
from app.services.profile_sync import create_mock_agent_updates, ensure_default_sources
from app.services.resume_parser import (
    ResumeParseError,
    build_legacy_resume_parse_response,
    parse_resume_text,
    parse_resume_upload,
)

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/sources", response_model=DataSourcesEnvelope)
def list_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DataSourcesEnvelope:
    ensure_default_sources(db, current_user.id)
    db.commit()
    rows = db.scalars(
        select(DataSource)
        .where(DataSource.user_id == current_user.id)
        .order_by(DataSource.created_at.asc())
    ).all()
    return DataSourcesEnvelope(sources=[to_data_source_out(item) for item in rows])


@router.post("/sources/{source_id}/toggle", response_model=DataSourceEnvelope)
def toggle_source(
    source_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DataSourceEnvelope:
    row = db.scalar(select(DataSource).where(DataSource.user_id == current_user.id, DataSource.id == source_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    row.is_connected = not row.is_connected
    if row.is_connected:
        row.last_sync = datetime.now(timezone.utc)

    db.commit()
    db.refresh(row)
    return DataSourceEnvelope(source=to_data_source_out(row))


@router.post("/check", response_model=AgentUpdatesEnvelope)
def check(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentUpdatesEnvelope:
    ensure_default_sources(db, current_user.id)
    create_mock_agent_updates(db, current_user.id)
    db.commit()
    rows = db.scalars(
        select(AgentUpdate)
        .where(AgentUpdate.user_id == current_user.id)
        .order_by(desc(AgentUpdate.date_found))
        .limit(20)
    ).all()
    return AgentUpdatesEnvelope(updates=[to_agent_update_out(item) for item in rows])


@router.get("/updates", response_model=AgentUpdatesEnvelope)
def list_updates(
    status_value: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentUpdatesEnvelope:
    stmt = select(AgentUpdate).where(AgentUpdate.user_id == current_user.id)
    if status_value in {"pending", "accepted", "rejected"}:
        stmt = stmt.where(AgentUpdate.status == status_value)
    rows = db.scalars(stmt.order_by(desc(AgentUpdate.date_found)).limit(200)).all()
    return AgentUpdatesEnvelope(updates=[to_agent_update_out(item) for item in rows])


@router.post("/generate-resume", response_model=GenerateResumeOut, deprecated=True)
def generate_resume(
    payload: GenerateResumeIn,
    current_user: User = Depends(get_current_user),
) -> GenerateResumeOut:
    """Legacy no-AI compatibility endpoint.

    New clients should call POST /resumes/parse-upload for ATS resume imports or save
    structured editor content through POST /resumes.
    """
    _ = current_user
    input_data = dict(payload.input or {})

    try:
        import_format = input_data.get("importFormat")
        require_ats = bool(import_format)
        if input_data.get("fileData"):
            result = parse_resume_upload(
                dict(input_data["fileData"]),
                import_format=str(import_format or "ats"),
                require_ats=require_ats,
            )
        else:
            resume_text = str(input_data.get("currentResumeText") or "")
            if not resume_text.strip():
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail=(
                        "AI resume generation has been removed. Use the structured editor to save a resume "
                        "or upload an ATS resume through /resumes/parse-upload."
                    ),
                )
            result = parse_resume_text(resume_text, require_ats=require_ats)
    except ResumeParseError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    text = build_legacy_resume_parse_response(result.text, result.resume, result.warnings)
    return GenerateResumeOut(text=text)
