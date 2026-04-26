from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.genai import types
from pypdf import PdfReader
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.common import to_agent_update_out, to_data_source_out
from app.models.entities import AgentUpdate, DataSource, User
from app.prompts import RESUME_FORGE_SYSTEM_PROMPT
from app.schemas.agent import (
    AgentUpdatesEnvelope,
    DataSourceEnvelope,
    DataSourcesEnvelope,
    GenerateResumeIn,
    GenerateResumeOut,
)
from app.services.gemini import get_gemini_client, get_model_name, make_config
from app.services.profile_sync import create_mock_agent_updates, ensure_default_sources

router = APIRouter(prefix="/agent", tags=["agent"])


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(pdf_bytes))
    return "\n".join((page.extract_text() or "") for page in reader.pages).replace("\r", "").strip()[:60000]


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


@router.post("/generate-resume", response_model=GenerateResumeOut)
def generate_resume(
    payload: GenerateResumeIn,
    current_user: User = Depends(get_current_user),
) -> GenerateResumeOut:
    _ = current_user
    input_data = dict(payload.input or {})
    client = get_gemini_client()
    model = get_model_name()

    parts: list[types.Part | str] = []
    file_data = input_data.get("fileData") or {}
    if file_data.get("data") and file_data.get("mimeType"):
        mime = str(file_data["mimeType"])
        raw_value = file_data["data"]
        decoded = base64.b64decode(raw_value) if isinstance(raw_value, str) else raw_value
        if "pdf" in mime:
            try:
                extracted = _extract_pdf_text(decoded)
                input_data["currentResumeText"] = extracted
                parts.append(f"EXTRACTED_RESUME_TEXT_FROM_PDF:\n{extracted}")
            except Exception:
                parts.append(types.Part.from_bytes(data=decoded, mime_type=mime))
        else:
            parts.append(types.Part.from_bytes(data=decoded, mime_type=mime))

    profile_image_data = input_data.get("profileImageData") or {}
    if profile_image_data.get("data") and profile_image_data.get("mimeType"):
        decoded = base64.b64decode(str(profile_image_data["data"]))
        parts.append(types.Part.from_bytes(data=decoded, mime_type=str(profile_image_data["mimeType"])))

    parts.append(f"MODE: {payload.mode}\n\nUSER_INPUT_JSON:\n{json.dumps(input_data, indent=2)}")

    try:
        response = client.models.generate_content(
            model=model,
            contents=parts,
            config=make_config(RESUME_FORGE_SYSTEM_PROMPT),
        )
        return GenerateResumeOut(text=response.text or "")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI generation failed") from exc
