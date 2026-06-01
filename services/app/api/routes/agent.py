from __future__ import annotations

import base64
import json
import re
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from xml.etree import ElementTree

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


def _limit_resume_text(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text.replace("\r", "")).strip()[:60000]


def _decode_upload_data(raw_value: object) -> bytes:
    if isinstance(raw_value, bytes):
        return raw_value
    if not isinstance(raw_value, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded resume file data is invalid.")
    try:
        return base64.b64decode(raw_value, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded resume file data is invalid.") from exc


def _file_metadata_for_prompt(file_data: dict) -> dict[str, str | bool]:
    safe: dict[str, str | bool] = {"textExtracted": True}
    if file_data.get("mimeType"):
        safe["mimeType"] = str(file_data["mimeType"])
    if file_data.get("name"):
        safe["name"] = str(file_data["name"])
    return safe


def _profile_image_metadata_for_prompt(profile_image_data: dict) -> dict[str, str | bool]:
    safe: dict[str, str | bool] = {"binaryOmitted": True}
    if profile_image_data.get("mimeType"):
        safe["mimeType"] = str(profile_image_data["mimeType"])
    return safe


def _raise_unreadable_import(kind: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Could not extract readable text from this {kind}. Please upload a text-based PDF or a DOCX file.",
    )


def _extract_docx_text(docx_bytes: bytes) -> str:
    with zipfile.ZipFile(BytesIO(docx_bytes)) as docx:
        names = [
            "word/document.xml",
            *sorted(name for name in docx.namelist() if name.startswith("word/header") and name.endswith(".xml")),
            *sorted(name for name in docx.namelist() if name.startswith("word/footer") and name.endswith(".xml")),
        ]

        chunks: list[str] = []
        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        for name in names:
            try:
                root = ElementTree.fromstring(docx.read(name))
            except Exception:
                continue

            paragraphs: list[str] = []
            for paragraph in root.findall(".//w:p", namespace):
                texts = [node.text or "" for node in paragraph.findall(".//w:t", namespace)]
                value = "".join(texts).strip()
                if value:
                    paragraphs.append(value)
            chunks.extend(paragraphs)

    return _limit_resume_text("\n".join(chunks))


def _extract_legacy_doc_text(doc_bytes: bytes) -> str:
    decoded = doc_bytes.decode("utf-8", errors="ignore") or doc_bytes.decode("latin-1", errors="ignore")
    printable_runs = re.findall(r"[A-Za-z0-9@#%&.,;:!?/()'\"+\-\s]{8,}", decoded.replace("\x00", " "))
    return _limit_resume_text("\n".join(run.strip() for run in printable_runs if run.strip()))


def _document_kind(mime: str, name: str = "") -> str | None:
    clean_mime = mime.lower().strip()
    lower_name = name.lower()
    if clean_mime == "application/pdf" or lower_name.endswith(".pdf"):
        return "pdf"
    if clean_mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or lower_name.endswith(".docx"):
        return "docx"
    if clean_mime == "application/msword" or lower_name.endswith(".doc"):
        return "doc"
    return None


SECTION_ALIASES: dict[str, set[str]] = {
    "summary": {"summary", "profile", "professional summary", "career summary", "objective"},
    "skills": {"skills", "technical skills", "core skills", "technologies", "tools"},
    "experience": {"experience", "work experience", "professional experience", "employment history", "work history"},
    "projects": {"projects", "selected projects", "project experience"},
    "education": {"education", "academic background"},
    "certifications": {"certifications", "certification", "licenses", "licenses and certifications"},
    "awards": {"awards", "honors", "achievements"},
    "publications": {"publications"},
}


def _clean_resume_line(line: str) -> str:
    return re.sub(r"^[\s\-\*\u2022\u00b7]+", "", line).strip()


def _resume_lines(text: str) -> list[str]:
    return [_clean_resume_line(line) for line in _limit_resume_text(text).splitlines() if _clean_resume_line(line)]


def _section_for_heading(line: str) -> str | None:
    if len(line) > 60:
        return None
    normalized = re.sub(r"[^A-Za-z& ]+", "", line).replace("&", "and").strip().lower()
    for section, aliases in SECTION_ALIASES.items():
        if normalized in aliases:
            return section
    return None


def _looks_like_email(line: str) -> bool:
    return bool(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", line))


def _looks_like_phone(line: str) -> bool:
    digits = re.sub(r"\D", "", line)
    return 7 <= len(digits) <= 15 and bool(re.search(r"[()\-+.\s]", line))


def _looks_like_url(line: str) -> bool:
    return bool(re.search(r"https?://|linkedin\.com|github\.com", line, flags=re.I))


def _is_contact_line(line: str) -> bool:
    return _looks_like_email(line) or _looks_like_phone(line) or _looks_like_url(line)


def _extract_header(lines: list[str]) -> dict[str, object]:
    header_window: list[str] = []
    for line in lines[:12]:
        if _section_for_heading(line):
            break
        header_window.append(line)

    email = ""
    phone = ""
    links: list[dict[str, str]] = []
    location = ""
    name = ""
    title = ""

    for line in header_window:
        if not email:
            match = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", line)
            if match:
                email = match.group(0)
        if not phone and _looks_like_phone(line):
            phone = line
        if _looks_like_url(line):
            links.append({"label": "Link", "url": line})
        if not location and "," in line and not _is_contact_line(line) and len(line) <= 90:
            location = line

    for line in header_window:
        if _is_contact_line(line) or line == location:
            continue
        if not name:
            name = line
            continue
        if not title and len(line) <= 100:
            title = line
            break

    return {
        "name": name,
        "title": title,
        "location": location,
        "phone": phone,
        "email": email,
        "links": links or [{"label": "LinkedIn", "url": ""}],
    }


def _sectionize_resume(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {key: [] for key in SECTION_ALIASES}
    current = "summary"
    for line in lines:
        section = _section_for_heading(line)
        if section:
            current = section
            continue
        sections.setdefault(current, []).append(line)
    return sections


def _skill_values(lines: list[str]) -> list[str]:
    values: list[str] = []
    for line in lines:
        source = line.split(":", 1)[1] if ":" in line else line
        for item in re.split(r"[,;|/]", source):
            value = item.strip(" .")
            if value and len(value) <= 60 and value not in values:
                values.append(value)
    return values[:30]


def _highlight_items(lines: list[str]) -> list[dict[str, object]]:
    highlights: list[dict[str, object]] = []
    for line in lines[:14]:
        metrics = re.findall(r"\b\d+(?:[.,]\d+)?%?\b", line)[:4]
        highlights.append({"bullet": line, "tags": [], "metrics": metrics})
    return highlights


def _local_resume_json_from_text(text: str) -> dict[str, object]:
    lines = _resume_lines(text)
    header = _extract_header(lines)
    sections = _sectionize_resume(lines)
    header_values = {str(value) for value in header.values() if isinstance(value, str) and value}

    summary_lines = [line for line in sections.get("summary", []) if line not in header_values and not _is_contact_line(line)]
    summary = " ".join(summary_lines[:3]).strip()

    experience_lines = [line for line in sections.get("experience", []) if not _is_contact_line(line)]
    education_lines = [line for line in sections.get("education", []) if not _is_contact_line(line)]
    project_lines = [line for line in sections.get("projects", []) if not _is_contact_line(line)]

    experience = []
    if experience_lines:
        experience.append({
            "company": "",
            "role": "",
            "location": "",
            "start": "",
            "end": "",
            "highlights": _highlight_items(experience_lines),
        })

    education = []
    if education_lines:
        education.append({
            "school": education_lines[0],
            "degree": education_lines[1] if len(education_lines) > 1 else "",
            "location": "",
            "start": "",
            "end": "",
            "notes": education_lines[2:8],
        })

    projects = []
    if project_lines:
        projects.append({"name": project_lines[0], "link": "", "description": "", "bullets": project_lines[1:8]})

    return {
        "header": header,
        "summary": summary,
        "skills": {
            "core": _skill_values(sections.get("skills", [])),
            "tools": [],
            "cloud": [],
            "data": [],
            "other": [],
        },
        "experience": experience,
        "projects": projects,
        "education": education,
        "certifications": sections.get("certifications", [])[:12],
        "awards": sections.get("awards", [])[:12],
        "publications": sections.get("publications", [])[:12],
    }


def _build_local_import_resume_response(input_data: dict) -> str | None:
    resume_text = _limit_resume_text(str(input_data.get("currentResumeText") or ""))
    if not resume_text:
        return None

    resume_json = _local_resume_json_from_text(resume_text)
    return f"""RESUME_JSON:
{json.dumps(resume_json, indent=2)}

GAP_AND_FIX_LIST:
- Imported with local parser because AI generation was unavailable.
- Review parsed fields, then add any missing employers, dates, metrics, and contact details.

RESUME_ATS:
{resume_text}

RESUME_HUMAN:
{resume_text}

RESUME_TARGETED:
{resume_text}

RESUME_WITH_PHOTO:
Use the live editor to add a profile photo if needed.

COVER_LETTER_FULL:
N/A - no job description provided

COVER_LETTER_SHORT:
N/A - no job description provided

COLD_EMAIL:
N/A - no job description provided"""


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

    parts: list[types.Part | str] = []
    file_data = input_data.get("fileData") or {}
    if file_data.get("data") and file_data.get("mimeType"):
        mime = str(file_data["mimeType"])
        name = str(file_data.get("name") or "")
        kind = _document_kind(mime, name)
        if not kind:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supported import formats: PDF, DOC, DOCX.",
            )

        decoded = _decode_upload_data(file_data["data"])
        if kind == "pdf":
            try:
                extracted = _extract_pdf_text(decoded)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Could not extract readable text from this PDF. Please upload a text-based PDF or DOCX file.",
                ) from exc
            if not extracted:
                _raise_unreadable_import("PDF")
            input_data["currentResumeText"] = extracted
            input_data["fileData"] = _file_metadata_for_prompt(file_data)
            parts.append(f"EXTRACTED_RESUME_TEXT_FROM_PDF:\n{extracted}")
        elif kind == "docx":
            try:
                extracted = _extract_docx_text(decoded)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Could not extract readable text from this DOCX file. Please upload a text-based PDF or DOCX file.",
                ) from exc
            if not extracted:
                _raise_unreadable_import("DOCX file")
            input_data["currentResumeText"] = extracted
            input_data["fileData"] = _file_metadata_for_prompt(file_data)
            parts.append(f"EXTRACTED_RESUME_TEXT_FROM_WORD_DOCUMENT:\n{extracted}")
        else:
            extracted = _extract_legacy_doc_text(decoded)
            if extracted:
                input_data["currentResumeText"] = extracted
                input_data["fileData"] = _file_metadata_for_prompt(file_data)
                parts.append(f"EXTRACTED_RESUME_TEXT_FROM_WORD_DOCUMENT:\n{extracted}")
            else:
                _raise_unreadable_import("Word document")

    profile_image_data = input_data.get("profileImageData") or {}
    if profile_image_data.get("data") and profile_image_data.get("mimeType"):
        decoded = _decode_upload_data(profile_image_data["data"])
        parts.append(types.Part.from_bytes(data=decoded, mime_type=str(profile_image_data["mimeType"])))
        input_data["profileImageData"] = _profile_image_metadata_for_prompt(profile_image_data)

    parts.append(f"MODE: {payload.mode}\n\nUSER_INPUT_JSON:\n{json.dumps(input_data, indent=2)}")

    try:
        client = get_gemini_client()
        model = get_model_name()
        response = client.models.generate_content(
            model=model,
            contents=parts,
            config=make_config(RESUME_FORGE_SYSTEM_PROMPT),
        )
        text = response.text or ""
        if not text.strip() and payload.mode == "MODE_A":
            fallback = _build_local_import_resume_response(input_data)
            if fallback:
                return GenerateResumeOut(text=fallback)
        return GenerateResumeOut(text=text)
    except Exception as exc:
        if payload.mode == "MODE_A":
            fallback = _build_local_import_resume_response(input_data)
            if fallback:
                return GenerateResumeOut(text=fallback)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI generation failed") from exc
