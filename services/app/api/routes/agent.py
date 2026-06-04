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


CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

PDF_SECTION_HEADINGS = (
    "summary",
    "profile",
    "skills",
    "experience",
    "education",
    "certifications",
    "projects",
)


def _normalize_extracted_text(text: str) -> str:
    lines: list[str] = []
    for raw_line in CONTROL_CHAR_RE.sub("", text).replace("\r", "\n").replace("\u00a0", " ").splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        lines.append(line)
    return _limit_resume_text("\n".join(lines).strip())


def _pdf_text_score(text: str) -> int:
    lines = [line for line in text.splitlines() if line.strip()]
    headings = sum(1 for line in lines if line.strip().lower().rstrip(":") in PDF_SECTION_HEADINGS)
    contacts = 1 if re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text) else 0
    return len(lines) + headings * 12 + contacts * 8


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(pdf_bytes))
    chunks: list[str] = []
    for page in reader.pages:
        candidates: list[str] = []
        for mode in ("layout", "plain"):
            try:
                extracted = page.extract_text(extraction_mode=mode) or ""
            except TypeError:
                extracted = page.extract_text() or ""
            except Exception:
                extracted = ""
            normalized = _normalize_extracted_text(extracted)
            if normalized:
                candidates.append(normalized)

        if candidates:
            chunks.append(max(candidates, key=_pdf_text_score))

    return _limit_resume_text("\n\n".join(chunks))


def _limit_resume_text(text: str) -> str:
    clean_text = CONTROL_CHAR_RE.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", clean_text.replace("\r", "")).strip()[:60000]


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
    "summary": {
        "summary",
        "profile",
        "professional summary",
        "professional profile",
        "career summary",
        "career profile",
        "executive summary",
        "objective",
        "about",
        "about me",
    },
    "skills": {
        "skills",
        "technical skills",
        "core skills",
        "technologies",
        "tools",
        "areas of expertise",
        "key skills",
        "technical competencies",
        "technical expertise",
        "technology",
        "technologies and tools",
        "competencies",
        "core competencies",
    },
    "experience": {
        "experience",
        "work experience",
        "work experience continued",
        "professional experience",
        "employment history",
        "employment experience",
        "work history",
        "career history",
        "career experience",
        "professional background",
    },
    "projects": {"projects", "selected projects", "project experience"},
    "education": {"education", "academic background", "academic history", "education and training"},
    "certifications": {
        "certifications",
        "certification",
        "licenses",
        "licenses and certifications",
        "certifications and licenses",
        "certificates",
    },
    "awards": {"awards", "honors", "achievements", "recognition"},
    "publications": {"publications"},
}

ROLE_KEYWORDS = {
    "accountant",
    "administrator",
    "advisor",
    "agile",
    "analyst",
    "architect",
    "associate",
    "coach",
    "consultant",
    "coordinator",
    "devops",
    "developer",
    "designer",
    "director",
    "engineer",
    "executive",
    "lead",
    "manager",
    "officer",
    "operator",
    "owner",
    "principal",
    "product",
    "program",
    "project",
    "qa",
    "recruiter",
    "scrum",
    "scientist",
    "security",
    "software",
    "specialist",
    "sre",
    "supervisor",
    "support",
    "technician",
    "tester",
}

DEGREE_KEYWORDS = {
    "bachelor",
    "master",
    "mba",
    "phd",
    "degree",
    "diploma",
    "certificate",
    "university",
    "college",
    "school",
}

DEGREE_ONLY_KEYWORDS = {
    "ba",
    "bachelor",
    "bs",
    "certificate",
    "degree",
    "diploma",
    "ma",
    "master",
    "mba",
    "ms",
    "phd",
}

DATE_RANGE_RE = re.compile(
    r"(?P<start>(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|"
    r"Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}[/.])?\s*(?:19|20)\d{2})\s*"
    r"(?:-|\u2013|\u2014|to|through|until)\s*"
    r"(?P<end>(?:Present|Current|Now|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}[/.])?\s*(?:19|20)\d{2}|Present|Current|Now)",
    flags=re.I,
)

DATE_VALUE_RE = re.compile(
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|"
    r"Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(?:19|20)\d{2}"
    r"|\d{1,2}[/.](?:19|20)?\d{2}"
    r"|(?:19|20)\d{2}",
    flags=re.I,
)


def _clean_resume_line(line: str) -> str:
    cleaned = CONTROL_CHAR_RE.sub("", line).replace("\u00a0", " ")
    cleaned = re.sub(r"[ \t]+", " ", cleaned).strip()
    return re.sub(r"^[\s\-\*\u2022\u00b7,]+", "", cleaned).strip(" \t;,")


def _resume_lines(text: str) -> list[str]:
    return [_clean_resume_line(line) for line in _limit_resume_text(text).splitlines() if _clean_resume_line(line)]


def _section_for_heading(line: str) -> str | None:
    if len(line) > 60:
        return None
    normalized = re.sub(r"[^A-Za-z& ]+", "", line).replace("&", "and")
    normalized = re.sub(r"\s+", " ", normalized).strip().lower()
    for section, aliases in SECTION_ALIASES.items():
        if normalized in aliases:
            return section
    return None


def _looks_like_email(line: str) -> bool:
    return bool(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", line))


def _looks_like_phone(line: str) -> bool:
    if DATE_RANGE_RE.search(line) and not re.search(r"\+|\(|\)|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b", line):
        return False
    digits = re.sub(r"\D", "", _extract_phone(line))
    return 7 <= len(digits) <= 15 and bool(re.search(r"[()\-+.\s]", line))


def _extract_phone(line: str) -> str:
    match = re.search(r"(?:\+?\(?\d[\d().\-\s]{6,}\d)", line)
    return match.group(0).strip() if match else ""


def _looks_like_url(line: str) -> bool:
    return bool(re.search(r"https?://|linkedin\.com|github\.com", line, flags=re.I))


def _is_contact_line(line: str) -> bool:
    return _looks_like_email(line) or _looks_like_phone(line) or _looks_like_url(line)


def _header_segments(lines: list[str]) -> list[str]:
    segments: list[str] = []
    for line in lines:
        for segment in re.split(r"\s+(?:\||\u2022|\u00b7)\s+", line):
            value = segment.strip(" ,;")
            if value:
                segments.append(value)
    return segments


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

    segments = _header_segments(header_window)

    for line in segments:
        if not email:
            match = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", line)
            if match:
                email = match.group(0)
        if not phone:
            phone = _extract_phone(line)
        if _looks_like_url(line):
            links.append({"label": "Link", "url": line})
        if not location and "," in line and not _is_contact_line(line) and len(line) <= 90:
            location = line

    for line in segments:
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
            value = _clean_resume_line(item).strip(" .")
            if value and len(value) <= 60 and value not in values:
                values.append(value)
    return values[:30]


def _highlight_items(lines: list[str]) -> list[dict[str, object]]:
    highlights: list[dict[str, object]] = []
    for line in lines[:14]:
        metrics = re.findall(r"\b\d+(?:[.,]\d+)?%?\b", line)[:4]
        highlights.append({"bullet": line, "tags": [], "metrics": metrics})
    return highlights


def _looks_like_date_range(line: str) -> bool:
    start, _ = _split_date_range(line)
    return bool(start)


def _split_date_range(line: str) -> tuple[str, str]:
    match = DATE_RANGE_RE.search(line)
    if match:
        return _normalize_date_value(match.group("start")), _normalize_date_value(match.group("end"))

    match = DATE_VALUE_RE.search(line)
    if match and _is_date_only_line(line):
        return _normalize_date_value(match.group(0)), ""

    return "", ""


def _strip_date_range(line: str) -> str:
    clean = DATE_RANGE_RE.sub("", line)
    clean = DATE_VALUE_RE.sub("", clean)
    return clean.strip(" -|,;()")


def _normalize_date_value(value: str) -> str:
    clean = re.sub(r"\s+", " ", value.strip(" -|,;()"))
    if clean.lower() in {"present", "current", "now"}:
        return "Present"
    return clean


def _is_date_only_line(line: str) -> bool:
    clean = line.strip(" -|,;()")
    if not clean:
        return False
    without_range = DATE_RANGE_RE.sub("", clean)
    if without_range != clean:
        return not without_range.strip(" -|,;()")
    return not DATE_VALUE_RE.sub("", clean).strip(" -|,;()")


def _looks_like_role_title(line: str) -> bool:
    if len(line) > 110 or _is_contact_line(line) or _section_for_heading(line) or _looks_like_date_range(line):
        return False
    words = set(re.findall(r"[A-Za-z]+", line.lower()))
    return bool(words & ROLE_KEYWORDS)


def _looks_like_location_line(line: str) -> bool:
    clean = line.strip(" ,;")
    if (
        not clean
        or len(clean) > 90
        or _is_contact_line(clean)
        or _section_for_heading(clean)
        or _looks_like_date_range(clean)
        or _looks_like_role_title(clean)
    ):
        return False

    if clean.lower() in {"remote", "hybrid", "onsite", "on-site"}:
        return True

    if re.search(r"\b(remote|hybrid|onsite|on-site)\b", clean, flags=re.I) and len(clean.split()) <= 6:
        return True

    if "," in clean:
        return bool(re.search(r"[A-Za-z]", clean)) and not re.search(r"\b(inc|llc|ltd|corp|corporation|company|group|solutions|systems|technologies)\b", clean, flags=re.I)

    return bool(re.match(r"^[A-Za-z .'-]+(?:\s+[A-Z]{2}|,\s*[A-Z]{2})(?:\s+\d{4,6})?$", clean))


def _looks_like_company_line(line: str) -> bool:
    clean = line.strip(" ,;")
    if (
        not clean
        or len(clean) > 100
        or _is_contact_line(clean)
        or _section_for_heading(clean)
        or _looks_like_date_range(clean)
        or _looks_like_role_title(clean)
        or _looks_like_location_line(clean)
    ):
        return False

    if re.search(r"\b(inc|llc|ltd|corp|corporation|company|group|solutions|systems|technologies|technology|consulting|partners|university|bank|health|labs)\b", clean, flags=re.I):
        return True

    words = re.findall(r"[A-Za-z0-9&]+", clean)
    if not words or len(words) > 5 or clean.endswith("."):
        return False

    minor_words = {"of", "and", "the", "for"}
    name_like_words = [
        word for word in words
        if word.lower() in minor_words or word[:1].isupper() or word.isupper() or any(char.isdigit() for char in word)
    ]
    return len(name_like_words) == len(words)


def _split_company_location(value: str) -> tuple[str, str]:
    segments = _role_company_segments(value)
    if len(segments) <= 1:
        return value.strip(" ,;"), ""

    company = segments[0]
    location_segments = [segment for segment in segments[1:] if _looks_like_location_line(segment)]
    if location_segments:
        return company, ", ".join(location_segments)

    return value.strip(" ,;"), ""


def _looks_like_degree_or_school(line: str) -> bool:
    words = set(re.findall(r"[A-Za-z]+", line.lower()))
    return bool(words & DEGREE_KEYWORDS)


def _looks_like_degree(line: str) -> bool:
    words = set(re.findall(r"[A-Za-z]+", line.lower()))
    return bool(words & DEGREE_ONLY_KEYWORDS)


def _detail_segments(line: str) -> list[str]:
    return [
        segment.strip(" ,;")
        for segment in re.split(r"\s+(?:\||\u2022|\u00b7)\s+", line)
        if segment.strip(" ,;")
    ]


def _role_company_segments(line: str) -> list[str]:
    segments = _detail_segments(line)
    if len(segments) == 1 and "," in line:
        segments = [segment.strip(" ,;") for segment in re.split(r"\s*,\s*", line) if segment.strip(" ,;")]
    return [segment for segment in segments if segment and not _looks_like_date_range(segment)]


def _assign_role_company_from_segments(segments: list[str]) -> tuple[str, str, str]:
    if not segments:
        return "", "", ""

    role = ""
    company = ""
    location = ""
    role_index = next((index for index, segment in enumerate(segments) if _looks_like_role_title(segment)), -1)

    if role_index >= 0:
        role = segments[role_index]
        remaining = [segment for index, segment in enumerate(segments) if index != role_index]
        if remaining:
            company = remaining[0]
        if len(remaining) > 1:
            location = ", ".join(remaining[1:])
    elif len(segments) >= 2:
        company = segments[0]
        if _looks_like_location_line(segments[1]):
            location = segments[1]
        else:
            role = segments[1]
        if len(segments) > 2:
            trailing_locations = [segment for segment in segments[2:] if _looks_like_location_line(segment)]
            if trailing_locations:
                location = ", ".join([location, *trailing_locations]).strip(" ,")
            elif not location:
                location = ", ".join(segments[2:])
    elif _looks_like_role_title(segments[0]):
        role = segments[0]

    return role, company, location


def _parse_role_company(line: str) -> dict[str, str] | None:
    start, end = _split_date_range(line)
    clean = _strip_date_range(line)
    if not clean:
        return None

    role = ""
    company = ""
    location = ""

    segments = _role_company_segments(clean)
    if len(segments) >= 2:
        role, company, location = _assign_role_company_from_segments(segments)

    if not role and not company:
        pieces = [piece.strip(" ,;") for piece in re.split(r"\s+(?:-|\u2013|\u2014)\s+", clean) if piece.strip(" ,;")]
        if len(pieces) >= 2:
            role, company, location = _assign_role_company_from_segments(pieces)
            if not role and not company:
                first, second = pieces[0], pieces[1]
                if _looks_like_role_title(first):
                    role, company = first, second
                elif _looks_like_role_title(second):
                    company, role = first, second
                else:
                    role, company = first, second

    if not role and not company:
        match = re.match(r"(?P<role>.+?)\s+(?:at|with)\s+(?P<company>.+)$", clean, flags=re.I)
        if match and _looks_like_role_title(match.group("role")):
            role = match.group("role").strip(" ,;")
            company, location = _split_company_location(match.group("company"))

    if not role and not company:
        pieces = [piece.strip(" ,;") for piece in re.split(r"\s+(?:-|\u2013|\u2014)\s+", clean, maxsplit=1)]
        if len(pieces) == 2:
            first, second = pieces
            if _looks_like_role_title(first):
                role, company = first, second
            elif _looks_like_role_title(second):
                company, role = first, second
            else:
                role, company = first, second

    if not role and _looks_like_role_title(clean):
        role = clean

    if not role and not company:
        return None

    return {
        "company": company,
        "role": role,
        "location": location,
        "start": start,
        "end": end,
    }


def _experience_start_at(lines: list[str], index: int) -> tuple[dict[str, str], int] | None:
    line = lines[index]
    next_line = lines[index + 1] if index + 1 < len(lines) else ""
    third_line = lines[index + 2] if index + 2 < len(lines) else ""
    fourth_line = lines[index + 3] if index + 3 < len(lines) else ""

    if _is_date_only_line(line):
        return None

    if _looks_like_company_line(line) and _looks_like_location_line(next_line) and _looks_like_role_title(third_line):
        parsed = {"company": line, "role": third_line, "location": next_line, "start": "", "end": ""}
        consumed = 3
        if _looks_like_date_range(fourth_line):
            parsed["start"], parsed["end"] = _split_date_range(fourth_line)
            consumed = 4
        return parsed, consumed

    if _looks_like_role_title(line) and _looks_like_company_line(next_line) and _looks_like_location_line(third_line):
        parsed = {"company": next_line, "role": line, "location": third_line, "start": "", "end": ""}
        consumed = 3
        if _looks_like_date_range(fourth_line):
            parsed["start"], parsed["end"] = _split_date_range(fourth_line)
            consumed = 4
        return parsed, consumed

    if _looks_like_company_line(line) and _looks_like_date_range(next_line) and _looks_like_role_title(third_line):
        start, end = _split_date_range(next_line)
        return {"company": line, "role": third_line, "location": "", "start": start, "end": end}, 3

    if _looks_like_role_title(line) and _looks_like_date_range(next_line) and _looks_like_company_line(third_line):
        start, end = _split_date_range(next_line)
        return {"company": third_line, "role": line, "location": "", "start": start, "end": end}, 3

    parsed = _parse_role_company(line)
    if parsed and not parsed["role"] and parsed["company"] and _looks_like_role_title(next_line):
        consumed = 2
        parsed["role"] = next_line
        if not parsed["start"] and _looks_like_date_range(third_line):
            parsed["start"], parsed["end"] = _split_date_range(third_line)
            consumed = 3
        elif not parsed["start"] and _looks_like_location_line(third_line):
            parsed["location"] = parsed["location"] or third_line
            consumed = 3
            if _looks_like_date_range(fourth_line):
                parsed["start"], parsed["end"] = _split_date_range(fourth_line)
                consumed = 4
        return parsed, consumed

    if parsed and (parsed["company"] or _looks_like_date_range(next_line) or len(_detail_segments(line)) >= 2):
        consumed = 1
        if not parsed["start"] and _looks_like_date_range(next_line):
            parsed["start"], parsed["end"] = _split_date_range(next_line)
            consumed = 2
        elif parsed["role"] and not parsed["location"] and _looks_like_location_line(next_line):
            parsed["location"] = next_line
            consumed = 2
            if not parsed["start"] and _looks_like_date_range(third_line):
                parsed["start"], parsed["end"] = _split_date_range(third_line)
                consumed = 3
        return parsed, consumed

    if next_line and _looks_like_role_title(next_line) and _looks_like_company_line(line):
        parsed = {"company": line, "role": next_line, "location": "", "start": "", "end": ""}
        consumed = 2
        if _looks_like_date_range(third_line):
            parsed["start"], parsed["end"] = _split_date_range(third_line)
            consumed = 3
        return parsed, consumed

    if _looks_like_role_title(line) and _looks_like_location_line(next_line):
        parsed = {"company": "", "role": line, "location": next_line, "start": "", "end": ""}
        consumed = 2
        if _looks_like_date_range(third_line):
            parsed["start"], parsed["end"] = _split_date_range(third_line)
            consumed = 3
        return parsed, consumed

    if _looks_like_role_title(line) and _looks_like_company_line(next_line):
        parsed = {"company": next_line, "role": line, "location": "", "start": "", "end": ""}
        consumed = 2
        if _looks_like_date_range(third_line):
            parsed["start"], parsed["end"] = _split_date_range(third_line)
            consumed = 3
        return parsed, consumed

    return None


def _parse_experience_entries(lines: list[str]) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    current_highlights: list[str] = []
    pending_start = ""
    pending_end = ""
    index = 0

    def flush_current() -> None:
        nonlocal current, current_highlights
        if not current:
            return
        current["highlights"] = _highlight_items(current_highlights)
        if current["role"] or current["company"] or current["highlights"]:
            entries.append(current)
        current = None
        current_highlights = []

    while index < len(lines):
        line = lines[index]
        if _is_date_only_line(line):
            start, end = _split_date_range(line)
            if current:
                current["start"] = start
                current["end"] = end
            else:
                pending_start = start
                pending_end = end
            index += 1
            continue

        start = _experience_start_at(lines, index)
        if start:
            flush_current()
            parsed, consumed = start
            current = {
                "company": parsed.get("company", ""),
                "role": parsed.get("role", ""),
                "location": parsed.get("location", ""),
                "start": parsed.get("start", "") or pending_start,
                "end": parsed.get("end", "") or pending_end,
                "highlights": [],
            }
            pending_start = ""
            pending_end = ""
            index += consumed
            continue

        if _looks_like_date_range(line) and current:
            current["start"], current["end"] = _split_date_range(line)
        elif _looks_like_location_line(line) and current and not current.get("location"):
            current["location"] = line
        elif line and not _is_contact_line(line):
            if current is None:
                current = {"company": "", "role": "", "location": "", "start": "", "end": "", "highlights": []}
            current_highlights.append(line)
        index += 1

    flush_current()
    return entries


def _parse_education_line(line: str) -> dict[str, object] | None:
    start, end = _split_date_range(line)
    clean = _strip_date_range(line)
    if not clean:
        return {
            "school": "",
            "degree": "",
            "location": "",
            "start": start,
            "end": end,
            "notes": [],
        } if start else None

    segments = _role_company_segments(clean)
    if len(segments) == 1:
        pieces = [piece.strip(" ,;") for piece in re.split(r"\s+(?:-|\u2013|\u2014)\s+", clean) if piece.strip(" ,;")]
        if len(pieces) >= 2:
            segments = pieces

    if len(segments) == 1 and "," in clean:
        segments = [segment.strip(" ,;") for segment in re.split(r"\s*,\s*", clean) if segment.strip(" ,;")]

    if not segments:
        return None

    degree_index = next(
        (index for index, segment in enumerate(segments) if _looks_like_degree(segment)),
        -1,
    )

    school = ""
    degree = ""
    location = ""
    notes: list[str] = []

    if degree_index >= 0:
        degree = segments[degree_index]
        school = next((segment for index, segment in enumerate(segments) if index != degree_index), "")
        notes = [segment for index, segment in enumerate(segments) if index not in {degree_index} and segment != school]
    elif len(segments) >= 2:
        school, degree = segments[0], segments[1]
        notes = segments[2:]
    else:
        if _looks_like_degree_or_school(segments[0]):
            if _looks_like_degree(segments[0]):
                degree = segments[0]
            else:
                school = segments[0]
        else:
            notes = [segments[0]]

    if notes:
        location = next((segment for segment in notes if "," in segment), "")
        notes = [segment for segment in notes if segment != location]

    if not any([school, degree, start, end]):
        return None

    return {
        "school": school,
        "degree": degree,
        "location": location,
        "start": start,
        "end": end,
        "notes": notes[:8],
    }


def _parse_education_entries(lines: list[str]) -> list[dict[str, object]]:
    clean_lines = [line for line in lines if not _is_contact_line(line)]
    if not clean_lines:
        return []

    compact_entries: list[dict[str, object]] = []
    for line in clean_lines:
        parsed = _parse_education_line(line)
        if parsed and (parsed["school"] or parsed["degree"]) and (
            len(_role_company_segments(_strip_date_range(line))) >= 2 or _looks_like_date_range(line)
        ):
            compact_entries.append(parsed)
    if compact_entries:
        return compact_entries[:6]

    date_line = next((line for line in clean_lines if _looks_like_date_range(line)), "")
    start, end = ("", "")
    if date_line:
        start, end = _split_date_range(date_line)

    content_lines = [
        _strip_date_range(line) if _looks_like_date_range(line) else line
        for line in clean_lines
    ]
    content_lines = [line for line in content_lines if line]
    if not content_lines:
        return [{"school": "", "degree": "", "location": "", "start": start, "end": end, "notes": []}]

    degree_index = next(
        (index for index, line in enumerate(content_lines) if _looks_like_degree(line)),
        next((index for index, line in enumerate(content_lines) if _looks_like_degree_or_school(line)), 0),
    )
    degree = content_lines[degree_index]
    school = ""
    if degree_index > 0:
        school = content_lines[degree_index - 1]
    elif len(content_lines) > 1:
        school = content_lines[1]

    notes = [
        line for index, line in enumerate(content_lines)
        if index not in {degree_index, max(0, degree_index - 1)}
    ]
    return [{
        "school": school,
        "degree": degree,
        "location": "",
        "start": start,
        "end": end,
        "notes": notes[:8],
    }]


def _parse_project_entries(lines: list[str]) -> list[dict[str, object]]:
    clean_lines = [line for line in lines if not _is_contact_line(line)]
    if not clean_lines:
        return []
    projects: list[dict[str, object]] = []
    current_name = clean_lines[0]
    bullets: list[str] = []
    for line in clean_lines[1:]:
        if len(line) <= 80 and not _looks_like_date_range(line) and not _looks_like_role_title(line) and bullets:
            projects.append({"name": current_name, "link": "", "description": "", "bullets": bullets[:8]})
            current_name = line
            bullets = []
        else:
            bullets.append(line)
    projects.append({"name": current_name, "link": "", "description": "", "bullets": bullets[:8]})
    return projects[:5]


def _local_resume_json_from_text(text: str) -> dict[str, object]:
    lines = _resume_lines(text)
    header = _extract_header(lines)
    sections = _sectionize_resume(lines)
    header_values = {str(value) for value in header.values() if isinstance(value, str) and value}

    summary_lines = [line for line in sections.get("summary", []) if line not in header_values and not _is_contact_line(line)]
    summary = " ".join(summary_lines[:3]).strip()

    experience = _parse_experience_entries([line for line in sections.get("experience", []) if not _is_contact_line(line)])
    education = _parse_education_entries([line for line in sections.get("education", []) if not _is_contact_line(line)])
    projects = _parse_project_entries([line for line in sections.get("projects", []) if not _is_contact_line(line)])

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
