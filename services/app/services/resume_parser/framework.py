from __future__ import annotations

import base64
import json
import re
import zipfile
from dataclasses import dataclass
from io import BytesIO
from xml.etree import ElementTree

from pypdf import PdfReader


class ResumeParseError(Exception):
    status_code = 422

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class UnsupportedResumeFileError(ResumeParseError):
    status_code = 400


class UnreadableResumeFileError(ResumeParseError):
    status_code = 422


class NonAtsResumeError(ResumeParseError):
    status_code = 422


@dataclass(frozen=True)
class ParsedResumeUpload:
    text: str
    resume: dict[str, object]
    warnings: list[str]
    confidence: dict[str, object]
    document: dict[str, object]
    ats_report: dict[str, object]


CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

PDF_SECTION_HEADINGS = (
    "summary",
    "profile",
    "skills",
    "experience",
    "education",
    "certifications",
    "projects",
    "awards",
    "publications",
    "languages",
    "volunteer",
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
        raise UnsupportedResumeFileError("Uploaded resume file data is invalid.")
    try:
        return base64.b64decode(raw_value, validate=True)
    except Exception as exc:
        raise UnsupportedResumeFileError("Uploaded resume file data is invalid.") from exc


def _file_metadata(file_data: dict) -> dict[str, str | bool]:
    safe: dict[str, str | bool] = {"textExtracted": True}
    if file_data.get("mimeType"):
        safe["mimeType"] = str(file_data["mimeType"])
    if file_data.get("name"):
        safe["name"] = str(file_data["name"])
    return safe


def _raise_unreadable_import(kind: str) -> None:
    raise UnreadableResumeFileError(
        f"Could not extract readable text from this {kind}. Please upload a text-based PDF or a DOCX file."
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


ATS_IMPORT_FORMATS = {"ats", "ats_resume", "ats-resume", "ats_resume_upload", "ats-resume-upload"}
ATS_CORE_SECTIONS = {"summary", "skills", "experience"}
ATS_RECOGNIZED_SECTIONS = {
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
    "certifications",
    "awards",
    "publications",
    "languages",
}
ATS_RECOMMENDED_SECTIONS = ("summary", "skills", "experience", "education")


def _requested_ats_import(input_data: dict) -> bool:
    raw = input_data.get("importFormat", input_data.get("import_format", ""))
    return str(raw).strip().lower() in ATS_IMPORT_FORMATS


def _ats_resume_report(text: str) -> dict[str, object]:
    lines = _resume_lines(text)
    sections: list[str] = []
    for line in lines:
        section = _section_for_heading(line)
        if section and section in ATS_RECOGNIZED_SECTIONS and section not in sections:
            sections.append(section)

    detected = set(sections)
    has_standard_workflow = "experience" in detected and bool(detected & {"summary", "skills"})
    has_entry_level_workflow = "skills" in detected and bool(detected & {"education", "projects", "certifications"})
    is_ats_like = (
        len(text.strip()) >= 80
        and len(detected & ATS_RECOGNIZED_SECTIONS) >= 2
        and (has_standard_workflow or has_entry_level_workflow)
    )

    return {
        "validated": is_ats_like,
        "sectionsDetected": sections,
        "missingRecommendedSections": [
            section for section in ATS_RECOMMENDED_SECTIONS if section not in detected
        ],
        "hasContactLine": any(_is_contact_line(line) for line in lines[:20]),
        "guidance": (
            "ATS import expects a readable, single-column PDF/DOC/DOCX with standard "
            "headings such as SUMMARY, SKILLS, EXPERIENCE, and EDUCATION."
        ),
    }


def _raise_non_ats_import(report: dict[str, object]) -> None:
    sections = report.get("sectionsDetected") or []
    detected = ", ".join(str(section).upper() for section in sections) if sections else "none"
    raise NonAtsResumeError(
        "This file was readable, but it does not look like an ATS resume. "
        "Please upload a text-based, single-column PDF or Word resume with standard "
        "headings such as SUMMARY, SKILLS, EXPERIENCE, and EDUCATION. "
        f"Detected sections: {detected}."
    )


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
        "experience highlights",
        "work experience",
        "work experience continued",
        "professional experience",
        "relevant experience",
        "selected experience",
        "leadership experience",
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
    "languages": {"languages", "language skills"},
    "volunteer": {"volunteer", "volunteering", "volunteer experience", "community involvement"},
    "affiliations": {"affiliations", "professional affiliations", "memberships", "associations"},
    "interests": {"interests", "hobbies", "activities"},
    "coursework": {"coursework", "relevant coursework", "professional development", "training"},
}

SECTION_LABELS: dict[str, str] = {
    "skills": "Skills",
    "projects": "Projects",
    "certifications": "Certifications",
    "awards": "Awards",
    "publications": "Publications",
    "languages": "Languages",
    "volunteer": "Volunteer",
    "affiliations": "Affiliations",
    "interests": "Interests",
    "coursework": "Coursework",
}

ROLE_KEYWORDS = {
    "accountant",
    "administrator",
    "advisor",
    "agile",
    "analyst",
    "architect",
    "associate",
    "assistant",
    "cashier",
    "coach",
    "clerk",
    "consultant",
    "coordinator",
    "devops",
    "developer",
    "designer",
    "director",
    "driver",
    "educator",
    "electrician",
    "engineer",
    "executive",
    "generalist",
    "intern",
    "lead",
    "manager",
    "mechanic",
    "nurse",
    "officer",
    "operator",
    "owner",
    "paralegal",
    "pharmacist",
    "principal",
    "product",
    "program",
    "project",
    "qa",
    "recruiter",
    "receptionist",
    "representative",
    "scrum",
    "scientist",
    "security",
    "software",
    "specialist",
    "sre",
    "supervisor",
    "support",
    "technician",
    "teacher",
    "tester",
    "therapist",
}

ROLE_DESCRIPTOR_KEYWORDS = {
    "agile",
    "devops",
    "product",
    "program",
    "project",
    "qa",
    "scrum",
    "security",
    "software",
    "sre",
}

CORE_ROLE_KEYWORDS = ROLE_KEYWORDS - ROLE_DESCRIPTOR_KEYWORDS

COMPANY_KEYWORD_RE = re.compile(
    r"\b(inc|llc|ltd|corp|corporation|company|group|solutions|systems|technologies|"
    r"technology|consulting|partners|university|bank|health|labs|security)\b",
    flags=re.I,
)

EDUCATION_INSTITUTION_KEYWORDS = {
    "academy",
    "college",
    "conservatory",
    "ecole",
    "escuela",
    "fachhochschule",
    "hochschule",
    "institute",
    "institut",
    "instituto",
    "lycee",
    "polytechnic",
    "school",
    "seminary",
    "universidad",
    "universidade",
    "universite",
    "university",
}

DEGREE_KEYWORDS = {
    "aa",
    "ba",
    "bachelor",
    "bba",
    "beng",
    "bsc",
    "bs",
    "certificate",
    "certification",
    "degree",
    "diploma",
    "doctorate",
    "ma",
    "master",
    "mba",
    "meng",
    "ms",
    "msc",
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

PDF_ARTIFACT_RE = re.compile(
    r"^(?:page\s+\d+(?:\s+of\s+\d+)?|resume|curriculum vitae|cv|confidential|"
    r"references available(?: upon request)?|generated by .+|download(?:ed)? .+|"
    r"applicant tracking system|ats friendly|professional resume|continued)$",
    flags=re.I,
)

ACTION_VERB_RE = re.compile(
    r"\b(?:achieved|administered|advised|aligned|architected|automated|built|coached|collaborated|"
    r"created|delivered|designed|developed|directed|drove|enabled|engineered|enhanced|executed|"
    r"facilitated|generated|guided|implemented|improved|increased|launched|led|managed|migrated|"
    r"modernized|optimized|owned|partnered|reduced|resolved|scaled|shipped|spearheaded|streamlined|"
    r"supported|transformed)\b",
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


def _looks_like_pdf_artifact(line: str) -> bool:
    clean = re.sub(r"\s+", " ", line.strip(" -|,;")).strip()
    if not clean:
        return True
    if PDF_ARTIFACT_RE.search(clean):
        return True
    if re.fullmatch(r"\d+\s*/\s*\d+", clean):
        return True
    if re.search(r"\b(?:www\.|http://|https://).+\b", clean, flags=re.I):
        return True
    return False


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
        if not location and not _is_contact_line(line) and len(line) <= 90 and ("," in line or _looks_like_location_line(line)):
            location = line

    candidate_segments = [
        line
        for line in segments
        if (
            not _is_contact_line(line)
            and line != location
            and not _section_for_heading(line)
            and not _looks_like_date_range(line)
        )
    ]

    preferred_name = next((line for line in candidate_segments if not _looks_like_role_title(line)), "")
    if preferred_name:
        name = preferred_name
    elif candidate_segments:
        name = candidate_segments[0]

    title = next((line for line in candidate_segments if line != name and _looks_like_role_title(line)), "")
    if not title:
        title = next((line for line in candidate_segments if line != name and len(line) <= 100), "")

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
        if _is_template_noise_line(line, allow_role=True, allow_company=True, allow_location=True):
            continue
        source = line.split(":", 1)[1] if ":" in line else line
        for item in re.split(r"[,;|/]", source):
            value = _clean_resume_line(item).strip(" .")
            if _is_skill_value(value) and value not in values:
                values.append(value)
    return values[:30]


STANDALONE_SKILL_CATEGORY_KEYS = {
    "ai",
    "ai security",
    "architecture",
    "backend",
    "boot",
    "cloud",
    "cloud engineering",
    "data",
    "databases",
    "engineering",
    "frameworks",
    "frontend",
    "languages",
    "platforms",
    "security",
    "tools",
}


def _normalize_skill_category_key(value: str) -> str:
    clean = value.replace("&", " ")
    clean = re.sub(r"[^A-Za-z0-9+#. ]+", " ", clean)
    return re.sub(r"\s+", " ", clean).strip().lower()


def _add_skill_group_values(groups: dict[str, list[str]], category: str, values: list[str]) -> None:
    label = category.strip(" :") or "Skills"
    if label not in groups:
        groups[label] = []
    for value in values:
        clean = _clean_resume_line(value).strip(" .")
        if _is_skill_value(clean) and clean not in groups[label]:
            groups[label].append(clean)


def _skill_values_from_text(value: str) -> list[str]:
    values: list[str] = []
    for item in re.split(r"[,;|/]", value):
        clean = _clean_resume_line(item).strip(" .")
        if _is_skill_value(clean) and clean not in values:
            values.append(clean)
    return values


def _parse_skill_category_line(line: str) -> tuple[str, list[str]] | None:
    if ":" not in line:
        return None

    category, value = [part.strip(" .") for part in line.split(":", 1)]
    if not category or not value or len(category) > 50:
        return None
    if _is_template_noise_line(category, allow_role=True, allow_company=True, allow_location=True):
        return None

    values = _skill_values_from_text(value)
    return (category, values) if values else None


def _is_standalone_skill_category(line: str, next_line: str) -> bool:
    if not next_line or ":" in line or any(delimiter in line for delimiter in [",", "|", ";", "/"]):
        return False
    if _parse_skill_category_line(next_line):
        return False

    clean = line.strip(" .")
    if _is_template_noise_line(clean, allow_role=True, allow_company=True, allow_location=True):
        return False
    if not _skill_values_from_text(next_line):
        return False
    return _normalize_skill_category_key(clean) in STANDALONE_SKILL_CATEGORY_KEYS


def _skill_groups_from_skill_lines(lines: list[str]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    current_category = "Skills"

    for index, line in enumerate(lines):
        if _is_template_noise_line(line, allow_role=True, allow_company=True, allow_location=True):
            continue

        category_line = _parse_skill_category_line(line)
        if category_line:
            category, values = category_line
            current_category = category
            _add_skill_group_values(groups, current_category, values)
            continue

        next_line = lines[index + 1] if index + 1 < len(lines) else ""
        if _is_standalone_skill_category(line, next_line):
            current_category = line.strip(" .")
            groups.setdefault(current_category, [])
            continue

        _add_skill_group_values(groups, current_category, _skill_values_from_text(line))

    return {category: values[:30] for category, values in groups.items() if values}


def _skill_groups_from_sections(sections: dict[str, list[str]]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    groups.update(_skill_groups_from_skill_lines(sections.get("skills", [])))

    return groups or {"Skills": []}


def _clean_additional_section_lines(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    for line in lines:
        value = _clean_resume_line(line)
        if (
            not value
            or _section_for_heading(value)
            or _is_date_only_line(value)
            or _looks_like_email(value)
            or _looks_like_phone(value)
        ):
            continue
        if value not in cleaned:
            cleaned.append(value)
    return cleaned


def _additional_sections_from_sections(sections: dict[str, list[str]]) -> list[dict[str, object]]:
    additional_sections: list[dict[str, object]] = []

    for section, label in SECTION_LABELS.items():
        if section == "skills":
            continue
        values = _clean_additional_section_lines(sections.get(section, []))
        if values:
            additional_sections.append({
                "title": label,
                "items": values[:40],
            })

    return additional_sections


def _highlight_items(lines: list[str]) -> list[dict[str, object]]:
    highlights: list[dict[str, object]] = []
    for line in lines:
        if not (_is_experience_highlight_line(line) or _is_experience_detail_line(line)):
            continue
        metrics = re.findall(r"\b\d+(?:[.,]\d+)?%?\b", line)[:4]
        highlights.append({"bullet": line, "tags": [], "metrics": metrics})
        if len(highlights) >= 14:
            break
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


def _starts_with_action_verb(line: str) -> bool:
    return bool(ACTION_VERB_RE.match(line.strip()))


def _looks_like_detail_fragment(line: str) -> bool:
    clean = line.strip(" -|,;")
    if not clean or _is_contact_line(clean) or _section_for_heading(clean) or _looks_like_date_range(clean):
        return False
    words = re.findall(r"[A-Za-z0-9+#.-]+", clean)
    if len(words) > 4:
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9+#.]+(?:[-/][A-Za-z0-9+#.]+)+", clean))


def _looks_like_title_case_phrase(line: str) -> bool:
    words = re.findall(r"[A-Za-z]+", line.strip())
    if not words:
        return False
    significant = [word for word in words if len(word) > 2][:4]
    if not significant:
        return False
    return all(word.isupper() or word[:1].isupper() for word in significant)


def _looks_like_role_title(line: str) -> bool:
    if len(line) > 110 or _is_contact_line(line) or _section_for_heading(line) or _looks_like_date_range(line):
        return False
    clean = line.strip()
    words = re.findall(r"[A-Za-z]+", clean.lower())
    if len(words) > 9:
        return False
    if clean.endswith(".") or (ACTION_VERB_RE.search(clean) and len(words) > 4):
        return False
    if _starts_with_action_verb(clean) and not _looks_like_title_case_phrase(clean):
        return False
    return bool(set(words) & ROLE_KEYWORDS)


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
    words = re.findall(r"[A-Za-z0-9&]+", clean)
    word_set = {word.lower() for word in words}
    has_company_keyword = bool(COMPANY_KEYWORD_RE.search(clean))

    if (
        not clean
        or len(clean) > 100
        or _is_contact_line(clean)
        or _section_for_heading(clean)
        or _looks_like_date_range(clean)
        or _looks_like_location_line(clean)
        or _looks_like_skill_list_line(clean)
    ):
        return False

    if has_company_keyword and not (word_set & CORE_ROLE_KEYWORDS):
        return True

    if _looks_like_role_title(clean):
        return False

    if not words or len(words) > 5 or clean.endswith("."):
        return False

    minor_words = {"of", "and", "the", "for"}
    name_like_words = [
        word for word in words
        if word.lower() in minor_words or word[:1].isupper() or word.isupper() or any(char.isdigit() for char in word)
    ]
    return len(name_like_words) == len(words)


def _looks_like_skill_list_line(line: str) -> bool:
    clean = line.strip()
    if not clean:
        return False
    delimiter_count = clean.count(",") + clean.count("|") + clean.count(";")
    words = re.findall(r"[A-Za-z0-9+#.-]+", clean)
    return delimiter_count >= 2 and len(words) >= 3 and not ACTION_VERB_RE.search(clean)


def _is_template_noise_line(
    line: str,
    *,
    allow_role: bool = False,
    allow_company: bool = False,
    allow_location: bool = False,
) -> bool:
    clean = line.strip(" -|,;")
    if not clean:
        return True
    if _looks_like_pdf_artifact(clean):
        return True
    if _section_for_heading(clean) or _is_contact_line(clean) or _is_date_only_line(clean):
        return True
    if not allow_location and _looks_like_location_line(clean):
        return True
    if not allow_company and _looks_like_company_line(clean):
        return True
    if not allow_role and _looks_like_role_title(clean):
        return True
    return False


def _is_skill_value(value: str) -> bool:
    clean = value.strip(" .")
    if not clean or len(clean) > 60:
        return False
    if _looks_like_education_institution(clean) or _looks_like_degree(clean):
        return False
    if _is_template_noise_line(clean, allow_role=True, allow_company=True, allow_location=True):
        return False
    words = re.findall(r"[A-Za-z0-9+#.-]+", clean)
    if len(words) > 7:
        return False
    if ACTION_VERB_RE.search(clean) and len(words) > 3:
        return False
    return True


def _is_summary_line(line: str, header_values: set[str]) -> bool:
    clean = line.strip()
    if clean in header_values:
        return False
    if _is_template_noise_line(clean, allow_role=True, allow_company=True, allow_location=True):
        return False
    if _looks_like_degree_or_school(clean) or _looks_like_skill_list_line(clean):
        return False
    words = re.findall(r"[A-Za-z0-9+#.-]+", clean)
    return len(clean) >= 20 and len(words) >= 4


def _is_experience_highlight_line(line: str) -> bool:
    clean = line.strip()
    if _looks_like_detail_fragment(clean):
        return True
    if _starts_with_action_verb(clean):
        if (
            _looks_like_pdf_artifact(clean)
            or _section_for_heading(clean)
            or _is_contact_line(clean)
            or _is_date_only_line(clean)
            or _looks_like_degree_or_school(clean)
            or _looks_like_skill_list_line(clean)
        ):
            return False
        words = re.findall(r"[A-Za-z0-9+#.-]+", clean)
        return len(words) >= 3 and len(clean) >= 10
    if _is_template_noise_line(clean):
        return False
    if _looks_like_degree_or_school(clean) or _looks_like_skill_list_line(clean):
        return False
    words = re.findall(r"[A-Za-z0-9+#.-]+", clean)
    if len(words) < 3 or len(clean) < 12:
        return False
    if len(words) <= 4 and not ACTION_VERB_RE.search(clean) and not re.search(r"\d|%", clean):
        return False
    return True


def _is_experience_detail_line(line: str) -> bool:
    clean = line.strip()
    if (
        not clean
        or _looks_like_pdf_artifact(clean)
        or _section_for_heading(clean)
        or _is_contact_line(clean)
        or _is_date_only_line(clean)
        or _looks_like_date_range(clean)
        or _looks_like_location_line(clean)
        or _looks_like_degree_or_school(clean)
        or _looks_like_skill_list_line(clean)
    ):
        return False

    if _looks_like_detail_fragment(clean) or _starts_with_action_verb(clean):
        return True
    if _looks_like_role_title(clean) or _looks_like_company_line(clean):
        return True

    words = re.findall(r"[A-Za-z0-9+#.-]+", clean)
    if len(words) < 3 or len(clean) < 10:
        return False
    if len(words) <= 4 and not ACTION_VERB_RE.search(clean) and not re.search(r"\d|%", clean):
        return False
    return True


def _clean_field_lines(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    for line in lines:
        value = _clean_resume_line(line)
        if _is_template_noise_line(value, allow_role=True, allow_company=True, allow_location=True):
            continue
        if value not in cleaned:
            cleaned.append(value)
    return cleaned


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
    return _looks_like_degree(line) or _looks_like_education_institution(line)


def _looks_like_degree(line: str) -> bool:
    words = set(re.findall(r"[A-Za-z]+", line.lower()))
    return bool(words & DEGREE_KEYWORDS)


def _looks_like_education_institution(line: str) -> bool:
    normalized = (
        line.lower()
        .replace("&", " ")
        .replace("\u00e9", "e")
        .replace("\u00e8", "e")
        .replace("\u00e1", "a")
        .replace("\u00ed", "i")
        .replace("\u00f3", "o")
        .replace("\u00fa", "u")
    )
    words = set(re.findall(r"[A-Za-z]+", normalized))
    if words & EDUCATION_INSTITUTION_KEYWORDS:
        return True
    return bool(re.search(
        r"\b(?:ucla|uc\s+berkeley|nyu|mit|caltech|stanford|harvard|oxford|cambridge)\b",
        normalized,
        flags=re.I,
    ))


def _detail_segments(line: str) -> list[str]:
    return [
        segment.strip(" ,;")
        for segment in re.split(r"\s+(?:\||\u2022|\u00b7)\s+", line)
        if segment.strip(" ,;")
    ]


def _role_company_segments(line: str) -> list[str]:
    segments = _detail_segments(line)
    if len(segments) == 1:
        dash_segments = [segment.strip(" ,;") for segment in re.split(r"\s+(?:-|\u2013|\u2014)\s+", line) if segment.strip(" ,;")]
        if len(dash_segments) >= 2:
            segments = dash_segments
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
        remaining = [(index, segment) for index, segment in enumerate(segments) if index != role_index]
        location_segments = [segment for _, segment in remaining if _looks_like_location_line(segment)]
        company = next(
            (segment for index, segment in remaining if index < role_index and not _looks_like_location_line(segment)),
            "",
        )
        if not company:
            company = next(
                (segment for index, segment in remaining if index > role_index and not _looks_like_location_line(segment)),
                "",
            )
        if not company:
            company = next((segment for _, segment in remaining if not _looks_like_location_line(segment)), "")
        if location_segments:
            location = ", ".join(location_segments)
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
    if _looks_like_skill_list_line(clean):
        guard_segments = _role_company_segments(clean)
        has_role_segment = any(_looks_like_role_title(segment) for segment in guard_segments)
        has_company_location_shape = (
            len(guard_segments) >= 2
            and (_looks_like_location_line(guard_segments[1]) or _looks_like_location_line(guard_segments[-1]))
        )
        has_company_suffix = bool(guard_segments and re.search(
            r"\b(inc|llc|ltd|corp|corporation|company|group|solutions|systems|technologies|technology|consulting|partners|labs)\b",
            guard_segments[0],
            flags=re.I,
        ))
        if not (has_role_segment or has_company_location_shape or has_company_suffix):
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
        if current["role"] or current["company"]:
            entries.append(current)
        current = None
        current_highlights = []

    def append_current_details(detail_lines: list[str]) -> None:
        if current is None:
            return
        for detail_line in detail_lines:
            if _is_experience_detail_line(detail_line) and detail_line not in current_highlights:
                current_highlights.append(detail_line)

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
            parsed, consumed = start
            has_associated_date = bool(parsed.get("start") or parsed.get("end") or pending_start or pending_end)
            if not has_associated_date:
                append_current_details(lines[index:index + consumed])
                index += consumed
                continue

            flush_current()
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

        if _looks_like_date_range(line) and current and not (current.get("start") or current.get("end")):
            current["start"], current["end"] = _split_date_range(line)
        elif _looks_like_location_line(line) and current and not current.get("location"):
            current["location"] = line
        elif current is not None and _is_experience_highlight_line(line):
            current_highlights.append(line)
        elif current is not None and _is_experience_detail_line(line):
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
        school = next(
            (
                segment for index, segment in enumerate(segments)
                if index != degree_index and _looks_like_education_institution(segment)
            ),
            "",
        )
        notes = [segment for index, segment in enumerate(segments) if index not in {degree_index} and segment != school]
    elif len(segments) >= 2:
        school_index = next(
            (index for index, segment in enumerate(segments) if _looks_like_education_institution(segment)),
            -1,
        )
        if school_index >= 0:
            school = segments[school_index]
            degree = next(
                (segment for index, segment in enumerate(segments) if index != school_index and _looks_like_degree(segment)),
                "",
            )
            notes = [segment for index, segment in enumerate(segments) if segment not in {school, degree}]
        else:
            notes = segments
    else:
        if _looks_like_degree_or_school(segments[0]):
            if _looks_like_degree(segments[0]):
                degree = segments[0]
            elif _looks_like_education_institution(segments[0]):
                school = segments[0]
        else:
            notes = [segments[0]]

    if notes:
        location_source = next((segment for segment in notes if _looks_like_location_line(segment) or "," in segment), "")
        location = location_source.strip(" |,;")
        notes = [segment for segment in notes if segment != location_source]

    if not school or not _looks_like_education_institution(school):
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

    if not any(_looks_like_education_institution(_strip_date_range(line)) for line in clean_lines):
        return []

    compact_entries: list[dict[str, object]] = []
    for line in clean_lines:
        parsed = _parse_education_line(line)
        if parsed and parsed["school"] and (
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
    content_lines = [
        line for line in content_lines
        if line and (
            _looks_like_education_institution(line)
            or _looks_like_degree(line)
            or _looks_like_location_line(line)
            or not _skill_values_from_text(line)
        )
    ]
    if not content_lines:
        return []

    school_index = next((index for index, line in enumerate(content_lines) if _looks_like_education_institution(line)), -1)
    if school_index < 0:
        return []

    school = content_lines[school_index]
    degree_index = next(
        (index for index, line in enumerate(content_lines) if index != school_index and _looks_like_degree(line)),
        -1,
    )
    degree = content_lines[degree_index] if degree_index >= 0 else ""

    notes = [
        line for index, line in enumerate(content_lines)
        if index not in {school_index, degree_index}
    ]
    location = next((line for line in notes if _looks_like_location_line(line)), "")
    notes = [line for line in notes if line != location]
    return [{
        "school": school,
        "degree": degree,
        "location": location,
        "start": start,
        "end": end,
        "notes": notes[:8],
    }]


def _education_section_skill_lines(lines: list[str]) -> list[str]:
    skill_lines: list[str] = []
    for line in lines:
        clean = _strip_date_range(line) if _looks_like_date_range(line) else line
        if not clean or _is_contact_line(clean):
            continue
        if _looks_like_location_line(clean):
            continue
        if _looks_like_education_institution(clean) or _looks_like_degree(clean):
            continue
        if _parse_skill_category_line(clean) or _skill_values_from_text(clean):
            skill_lines.append(clean)
    return skill_lines


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

    summary_lines = [line for line in sections.get("summary", []) if _is_summary_line(line, header_values)]
    summary = " ".join(summary_lines[:3]).strip()

    header_name = str(header.get("name") or "")
    experience = _parse_experience_entries([
        line for line in sections.get("experience", [])
        if not _is_contact_line(line) and line != header_name
    ])
    education_lines = [line for line in sections.get("education", []) if not _is_contact_line(line)]
    education = _parse_education_entries(education_lines)
    skill_groups = _skill_groups_from_sections(sections)
    for category, values in _skill_groups_from_skill_lines(_education_section_skill_lines(education_lines)).items():
        _add_skill_group_values(skill_groups, category, values)
    additional_sections = _additional_sections_from_sections(sections)

    return {
        "header": header,
        "summary": summary,
        "skills": skill_groups,
        "experience": experience,
        "education": education,
        "additionalSections": additional_sections,
    }


def _build_local_import_resume_response(input_data: dict) -> str | None:
    resume_text = _limit_resume_text(str(input_data.get("currentResumeText") or ""))
    if not resume_text:
        return None

    resume_json = _local_resume_json_from_text(resume_text)
    warnings = [
        "Imported with the deterministic ATS parser.",
        "Review parsed fields, then add any missing employers, dates, metrics, and contact details.",
    ]
    return build_legacy_resume_parse_response(resume_text, resume_json, warnings)


def _replace_response_resume_json(text: str, resume_json: dict[str, object]) -> str | None:
    start_marker = "RESUME_JSON:"
    end_marker = "GAP_AND_FIX_LIST:"
    start_index = text.find(start_marker)
    if start_index < 0:
        return None

    start = start_index + len(start_marker)
    end = text.find(end_marker, start)
    if end < 0:
        return None

    replacement = "\n" + json.dumps(resume_json, indent=2) + "\n\n"
    return text[:start] + replacement + text[end:]


def _response_with_understood_resume_json(
    text: str,
    understood_resume_json: dict[str, object] | None,
    input_data: dict,
) -> str:
    if not understood_resume_json:
        return text

    replaced = _replace_response_resume_json(text, understood_resume_json)
    if replaced:
        return replaced

    return _build_local_import_resume_response(input_data) or text


def _extract_upload_text(file_data: dict[str, object]) -> tuple[str, str, dict[str, object]]:
    mime = str(file_data.get("mimeType") or "")
    name = str(file_data.get("name") or "")
    kind = _document_kind(mime, name)
    if not kind:
        raise UnsupportedResumeFileError("Supported import formats: PDF, DOC, DOCX.")

    decoded = _decode_upload_data(file_data.get("data"))
    if kind == "pdf":
        try:
            extracted = _extract_pdf_text(decoded)
        except Exception as exc:
            raise UnreadableResumeFileError(
                "Could not extract readable text from this PDF. Please upload a text-based PDF or DOCX file."
            ) from exc
        if not extracted:
            _raise_unreadable_import("PDF")
    elif kind == "docx":
        try:
            extracted = _extract_docx_text(decoded)
        except Exception as exc:
            raise UnreadableResumeFileError(
                "Could not extract readable text from this DOCX file. Please upload a text-based PDF or DOCX file."
            ) from exc
        if not extracted:
            _raise_unreadable_import("DOCX file")
    else:
        extracted = _extract_legacy_doc_text(decoded)
        if not extracted:
            _raise_unreadable_import("Word document")

    metadata = _file_metadata(file_data)
    metadata["kind"] = kind
    return extracted, kind, metadata


def _warnings_for_resume(resume: dict[str, object], ats_report: dict[str, object]) -> list[str]:
    warnings: list[str] = []
    missing_sections = ats_report.get("missingRecommendedSections") or []
    for section in missing_sections:
        warnings.append(f"Recommended ATS section missing or not detected: {str(section).upper()}.")

    if not ats_report.get("hasContactLine"):
        warnings.append("No email, phone, or profile link was detected in the resume header.")

    for index, item in enumerate(resume.get("experience", []) if isinstance(resume.get("experience"), list) else []):
        if isinstance(item, dict) and not (item.get("start") or item.get("end")):
            label = item.get("role") or item.get("company") or f"experience entry {index + 1}"
            warnings.append(f"Work experience entry missing dates: {label}.")

    for index, item in enumerate(resume.get("education", []) if isinstance(resume.get("education"), list) else []):
        if isinstance(item, dict) and not item.get("school"):
            warnings.append(f"Education entry {index + 1} is missing a school name.")

    return warnings


def _confidence_for_resume(resume: dict[str, object], ats_report: dict[str, object]) -> dict[str, object]:
    sections = ats_report.get("sectionsDetected") or []
    experience = resume.get("experience") if isinstance(resume.get("experience"), list) else []
    education = resume.get("education") if isinstance(resume.get("education"), list) else []
    skills = resume.get("skills") if isinstance(resume.get("skills"), dict) else {}
    skill_count = sum(len(values) for values in skills.values() if isinstance(values, list))
    return {
        "atsValidated": bool(ats_report.get("validated")),
        "sectionsDetected": len(sections),
        "contactDetected": bool(ats_report.get("hasContactLine")),
        "experienceEntries": len(experience),
        "educationEntries": len(education),
        "skillCount": skill_count,
    }


def parse_resume_text(text: str, *, require_ats: bool = True, document: dict[str, object] | None = None) -> ParsedResumeUpload:
    resume_text = _limit_resume_text(text)
    if not resume_text:
        _raise_unreadable_import("ATS resume")

    ats_report = _ats_resume_report(resume_text)
    if require_ats and not ats_report["validated"]:
        _raise_non_ats_import(ats_report)

    resume = _local_resume_json_from_text(resume_text)
    warnings = _warnings_for_resume(resume, ats_report)
    return ParsedResumeUpload(
        text=resume_text,
        resume=resume,
        warnings=warnings,
        confidence=_confidence_for_resume(resume, ats_report),
        document=document or {"textExtracted": True},
        ats_report=ats_report,
    )


def parse_resume_upload(
    file_data: dict[str, object],
    *,
    import_format: str | None = "ats",
    require_ats: bool = True,
) -> ParsedResumeUpload:
    extracted, _kind, metadata = _extract_upload_text(file_data)
    normalized_format = str(import_format or "ats").strip().lower()
    if require_ats and normalized_format not in ATS_IMPORT_FORMATS:
        raise UnsupportedResumeFileError("Supported import format: ats.")
    return parse_resume_text(extracted, require_ats=require_ats, document=metadata)


def build_legacy_resume_parse_response(
    resume_text: str,
    resume_json: dict[str, object],
    warnings: list[str] | None = None,
) -> str:
    all_warnings = ["Parsed with the deterministic ATS parser.", *(warnings or [])]
    warning_lines = "\n".join(f"- {warning}" for warning in all_warnings)
    if not warning_lines:
        warning_lines = "- Parsed with the deterministic ATS parser."
    return f"""RESUME_JSON:
{json.dumps(resume_json, indent=2)}

GAP_AND_FIX_LIST:
{warning_lines}

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

