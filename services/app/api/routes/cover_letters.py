from __future__ import annotations

import ipaddress
import json
import re
import textwrap
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
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

MAX_JOB_DESCRIPTION_CHARS = 20000
MAX_JOB_SOURCE_CHARS = 500000
JOB_URL_ERROR = "Could not process the job URL. Paste the job description instead."
MAX_RESUME_PROMPT_STRING_CHARS = 12000
MAX_RESUME_PROMPT_COLLECTION_ITEMS = 80


class _VisibleTextParser(HTMLParser):
    block_tags = {"article", "br", "div", "h1", "h2", "h3", "h4", "li", "p", "section", "td", "th", "tr"}
    ignored_tags = {"script", "style", "noscript", "svg"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        clean_tag = tag.lower()
        if clean_tag in self.ignored_tags:
            self._ignored_depth += 1
            return
        if self._ignored_depth:
            return
        if clean_tag == "li":
            self._chunks.append("\n- ")
        elif clean_tag in self.block_tags:
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        clean_tag = tag.lower()
        if clean_tag in self.ignored_tags and self._ignored_depth:
            self._ignored_depth -= 1
            return
        if not self._ignored_depth and clean_tag in self.block_tags:
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth and data.strip():
            self._chunks.append(data)

    def text(self) -> str:
        return "".join(self._chunks)


def extract(raw_text: str, start_marker: str, end_marker: str | None) -> str | None:
    start_index = raw_text.find(start_marker)
    if start_index == -1:
        return None
    start = start_index + len(start_marker)
    end = raw_text.find(end_marker, start) if end_marker else len(raw_text)
    if end == -1:
        end = len(raw_text)
    return raw_text[start:end].strip()


def _clean_text(text: str) -> str:
    normalized = text.replace("\r", "\n")
    normalized = re.sub(r"[ \t\f\v]+", " ", normalized)
    normalized = re.sub(r" *\n *", "\n", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _html_to_text(html: str) -> str:
    parser = _VisibleTextParser()
    parser.feed(html)
    parser.close()
    return _clean_text(parser.text())


def _sanitize_resume_context(value, *, depth: int = 0):
    """Remove uploaded binary blobs before sending resume context to the AI model."""
    if depth > 8:
        return "[TRUNCATED]"

    binary_keys = {
        "data",
        "fileData",
        "profileImageData",
        "legacyProfileImageData",
        "profileImageUrl",
        "profileImageName",
    }

    if isinstance(value, dict):
        clean: dict[str, object] = {}
        for key, item in value.items():
            clean_key = str(key)
            if clean_key in binary_keys:
                continue
            clean[clean_key] = _sanitize_resume_context(item, depth=depth + 1)
        return clean

    if isinstance(value, list):
        return [
            _sanitize_resume_context(item, depth=depth + 1)
            for item in value[:MAX_RESUME_PROMPT_COLLECTION_ITEMS]
        ]

    if isinstance(value, str):
        cleaned = _clean_text(value)
        if len(cleaned) > MAX_RESUME_PROMPT_STRING_CHARS:
            return f"{cleaned[:MAX_RESUME_PROMPT_STRING_CHARS]}...[TRUNCATED]"
        return cleaned

    return value


def _validate_job_url(job_url: str) -> str:
    clean_url = job_url.strip()
    parsed = urlparse(clean_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(JOB_URL_ERROR)

    host = (parsed.hostname or "").lower()
    if host in {"localhost", "0.0.0.0"} or host.endswith(".local"):
        raise ValueError(JOB_URL_ERROR)

    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None

    if address and (address.is_private or address.is_loopback or address.is_link_local or address.is_reserved):
        raise ValueError(JOB_URL_ERROR)

    return clean_url


def _infer_job_title(job_description: str, fallback_url: str | None = None) -> str:
    ignored_prefixes = (
        "about ",
        "apply",
        "benefits",
        "company",
        "description",
        "job description",
        "responsibilities",
        "requirements",
        "salary",
        "who we are",
    )
    for raw_line in job_description.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip(" -:|")
        if not 4 <= len(line) <= 120:
            continue
        lower = line.lower()
        if lower.startswith(ignored_prefixes):
            continue
        if any(keyword in lower for keyword in ("engineer", "developer", "manager", "analyst", "designer", "architect", "specialist", "director", "lead", "consultant")):
            return line[:200]

    if fallback_url:
        parsed = urlparse(fallback_url)
        slug = parsed.path.rstrip("/").split("/")[-1]
        slug = re.sub(r"[-_]+", " ", slug).strip()
        if 4 <= len(slug) <= 120:
            return slug.title()[:200]

    return "Cover Letter"


def _fetch_job_description_from_url(job_url: str) -> tuple[str, str]:
    clean_url = _validate_job_url(job_url)
    try:
        response = httpx.get(
            clean_url,
            follow_redirects=True,
            timeout=10.0,
            headers={"User-Agent": "ResumeForgeBot/1.0 (+https://resumeforge.local)"},
        )
    except httpx.RequestError as exc:
        raise ValueError(JOB_URL_ERROR) from exc

    if response.status_code >= 400:
        raise ValueError(JOB_URL_ERROR)

    content_type = response.headers.get("content-type", "").lower()
    raw = response.text[:MAX_JOB_SOURCE_CHARS]
    if "html" in content_type or "<html" in raw[:1000].lower():
        text = _html_to_text(raw)
    else:
        text = _clean_text(raw)

    if len(text) < 120:
        raise ValueError(JOB_URL_ERROR)

    return text[:MAX_JOB_DESCRIPTION_CHARS], _infer_job_title(text, clean_url)


def _resolve_job_source(payload: GenerateCoverLetterIn) -> tuple[str, str | None, str]:
    job_url = (payload.jobUrl or "").strip() or None
    job_description = (payload.jobDescription or "").strip()
    inferred_title = ""

    if job_url:
        try:
            job_description, inferred_title = _fetch_job_description_from_url(job_url)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if len(job_description) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a job description of at least 20 characters or a URL that can be processed.",
        )

    if not inferred_title:
        inferred_title = _infer_job_title(job_description, job_url)

    return job_description[:MAX_JOB_DESCRIPTION_CHARS], job_url, inferred_title


def _safe_filename(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_")[:80] or "cover_letter"


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_cover_letter_pdf(title: str, body: str) -> bytes:
    body_lines: list[str] = []
    for paragraph in (body or "").splitlines():
        if not paragraph.strip():
            body_lines.append("")
            continue
        body_lines.extend(textwrap.wrap(paragraph.strip(), width=88) or [""])

    lines = [title.strip() or "Cover Letter", ""] + body_lines
    max_lines_per_page = 48
    pages = [lines[index:index + max_lines_per_page] for index in range(0, len(lines), max_lines_per_page)] or [[]]

    objects: list[bytes] = []

    def add_object(content: bytes) -> int:
        objects.append(content)
        return len(objects)

    add_object(b"<< /Type /Catalog /Pages 2 0 R >>")
    add_object(b"")
    add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_refs: list[str] = []
    for page_lines in pages:
        commands: list[str] = []
        y = 790
        for index, line in enumerate(page_lines):
            size = 16 if index == 0 else 11
            line_height = 24 if index == 0 else 15
            commands.append(f"BT /F1 {size} Tf 1 0 0 1 54 {y} Tm ({_pdf_escape(line)}) Tj ET")
            y -= line_height
        stream = "\n".join(commands).encode("latin-1", errors="replace")
        content_object = add_object(b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream")
        page_object = add_object(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_object} 0 R >>".encode("ascii")
        )
        page_refs.append(f"{page_object} 0 R")

    objects[1] = f"<< /Type /Pages /Kids [{' '.join(page_refs)}] /Count {len(page_refs)} >>".encode("ascii")

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, content in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode("ascii"))
        pdf.extend(content)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    return bytes(pdf)


def _resume_highlights(resume_context) -> list[str]:
    if not isinstance(resume_context, dict):
        return []

    highlights: list[str] = []
    personal = resume_context.get("personalDetails")
    if isinstance(personal, dict) and personal.get("summary"):
        highlights.append(str(personal["summary"]))

    for item in resume_context.get("experienceItems") or []:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        company = str(item.get("company") or "").strip()
        description = str(item.get("description") or "").strip()
        parts = [part for part in (role, company) if part]
        if description:
            parts.append(description)
        if parts:
            highlights.append(" - ".join(parts))

    skill_values: list[str] = []
    for item in resume_context.get("skillItems") or []:
        if isinstance(item, dict) and item.get("items"):
            skill_values.append(str(item["items"]))
    if skill_values:
        highlights.append("Skills: " + ", ".join(skill_values[:4]))

    return [_clean_text(value)[:500] for value in highlights if _clean_text(value)][:6]


def _job_priorities(job_description: str) -> list[str]:
    priorities: list[str] = []
    keywords = (
        "experience",
        "architecture",
        "engineer",
        "platform",
        "cloud",
        "devops",
        "lead",
        "mentor",
        "responsible",
        "build",
        "design",
        "ai",
    )
    for raw_line in job_description.splitlines():
        line = re.sub(r"^\s*[-*]\s*", "", raw_line).strip()
        if not 30 <= len(line) <= 260:
            continue
        lower = line.lower()
        if any(keyword in lower for keyword in keywords):
            priorities.append(line)
        if len(priorities) >= 5:
            break
    return priorities


def _build_local_cover_letter(title: str, job_description: str, resume_context, current_user: User) -> tuple[str, str, str, str]:
    role = title or _infer_job_title(job_description)
    name = current_user.name or "[YOUR NAME]"
    highlights = _resume_highlights(resume_context)
    priorities = _job_priorities(job_description)
    primary_highlight = highlights[0] if highlights else "[NEEDS USER INPUT: add the most relevant resume achievement]"
    secondary_highlight = highlights[1] if len(highlights) > 1 else primary_highlight
    priority_text = "; ".join(priorities[:3]) if priorities else "the responsibilities and qualifications described in the job posting"

    full = f"""Dear Hiring Team,

I am excited to apply for the {role} role. The opportunity stood out because it emphasizes {priority_text}, which aligns with the background and strengths reflected in my resume.

A relevant example from my experience is: {primary_highlight}. I would bring that same practical, outcome-focused approach to this role, especially where the team needs someone who can understand the business context, work across technical details, and help turn priorities into dependable delivery.

I also bring experience that connects to this posting through: {secondary_highlight}. I would welcome the chance to discuss how my background can support your team and contribute to the work ahead.

Thank you for your time and consideration.

Sincerely,
{name}"""

    short = f"""Dear Hiring Team,

I am excited to apply for the {role} role. My background includes {primary_highlight}, and I see a strong connection to your need for {priority_text}. I would welcome the opportunity to discuss how I can contribute to your team.

Sincerely,
{name}"""

    cold_email = f"""Hello,

I am interested in the {role} role and wanted to share my resume for consideration.

My background includes {primary_highlight}.

I would be glad to discuss how that experience maps to your team's needs.

Best,
{name}"""

    raw = "LOCAL_FALLBACK_COVER_LETTER: Gemini generation failed, so ResumeForge created a conservative saved draft from the parsed job description and resume context."
    return full, short, cold_email, raw


@router.post("/generate", response_model=CoverLetterEnvelope, status_code=status.HTTP_201_CREATED)
def generate(payload: GenerateCoverLetterIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CoverLetterEnvelope:
    job_description, job_url, inferred_title = _resolve_job_source(payload)
    title = (payload.title or inferred_title or "Cover Letter")[:200]
    resume_context = _sanitize_resume_context(payload.resumeJson)
    user_prompt = f"""You are generating ONLY cover letter outputs.

Return EXACTLY these sections (no resume sections):
COVER_LETTER_FULL:
<text>

COVER_LETTER_SHORT:
<text>

COLD_EMAIL:
<text>

USER_CONTEXT_JSON:
{json.dumps({'name': current_user.name, 'email': current_user.email, 'templateId': payload.templateId, 'jobUrl': job_url, 'jobDescription': job_description, 'resumeJson': resume_context}, indent=2)}"""
    try:
        client = get_gemini_client()
        model = get_model_name()
        response = client.models.generate_content(model=model, contents=[user_prompt], config=make_config(RESUME_FORGE_SYSTEM_PROMPT))
        raw = response.text or ""
        cover_letter_full = extract(raw, "COVER_LETTER_FULL:", "COVER_LETTER_SHORT:") or raw.strip()
        cover_letter_short = extract(raw, "COVER_LETTER_SHORT:", "COLD_EMAIL:") or ""
        cold_email = extract(raw, "COLD_EMAIL:", None) or ""
        if not cover_letter_full.strip():
            raise RuntimeError("AI response did not include cover letter content")
        generation_source = "ai"
    except Exception:
        cover_letter_full, cover_letter_short, cold_email, raw = _build_local_cover_letter(
            title,
            job_description,
            resume_context,
            current_user,
        )
        generation_source = "local_fallback"

    entity = CoverLetter(
        id=new_prefixed_id("cl"),
        user_id=current_user.id,
        template_id=payload.templateId,
        title=title,
        job_description=job_description,
        content={
            "coverLetterFull": cover_letter_full,
            "coverLetterShort": cover_letter_short,
            "coldEmail": cold_email,
            "raw": raw,
            "jobUrl": job_url,
            "generationSource": generation_source,
        },
    )
    try:
        db.add(entity)
        db.flush()
        details = f"Template: {payload.templateId or 'n/a'}, Source: {generation_source}"
        log_activity(db, current_user.id, "COVERLETTER_GENERATE", details=details, user_name=current_user.name)
        db.commit()
        db.refresh(entity)
        return CoverLetterEnvelope(coverLetter=to_cover_letter_out(entity))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not save cover letter.") from exc


@router.get("/", response_model=CoverLettersEnvelope)
def list_cover_letters(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CoverLettersEnvelope:
    rows = db.scalars(select(CoverLetter).where(CoverLetter.user_id == current_user.id).order_by(desc(CoverLetter.created_at))).all()
    return CoverLettersEnvelope(coverLetters=[to_cover_letter_out(item) for item in rows])


@router.get("/{cover_letter_id}", response_model=CoverLetterEnvelope)
def get_cover_letter(cover_letter_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CoverLetterEnvelope:
    row = db.scalar(select(CoverLetter).where(CoverLetter.user_id == current_user.id, CoverLetter.id == cover_letter_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return CoverLetterEnvelope(coverLetter=to_cover_letter_out(row))


@router.get("/{cover_letter_id}/pdf")
def download_cover_letter_pdf(cover_letter_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    row = db.scalar(select(CoverLetter).where(CoverLetter.user_id == current_user.id, CoverLetter.id == cover_letter_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    content = row.content if isinstance(row.content, dict) else {}
    body = str(content.get("coverLetterFull") or "")
    pdf = _build_cover_letter_pdf(row.title, body)
    filename = f"{_safe_filename(row.title)}_{row.id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{cover_letter_id}", response_model=OkResponse)
def delete_cover_letter(cover_letter_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    row = db.scalar(select(CoverLetter).where(CoverLetter.user_id == current_user.id, CoverLetter.id == cover_letter_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(row)
    db.commit()
    return OkResponse(ok=True)
