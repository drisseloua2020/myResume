from __future__ import annotations

import base64
import io
import json
import re
import textwrap
from collections import Counter
from datetime import UTC, date, datetime
from html import escape
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

ACTION_VERBS = {
    "accelerated", "achieved", "automated", "built", "coached", "created", "delivered", "designed",
    "developed", "drove", "enabled", "improved", "increased", "launched", "led", "managed",
    "migrated", "optimized", "reduced", "resolved", "shipped", "streamlined", "transformed",
}

SOFT_SKILLS = {
    "communication", "collaboration", "leadership", "mentoring", "stakeholder management",
    "problem solving", "analytical", "adaptability", "ownership", "cross-functional",
}

CERTIFICATIONS = {
    "cissp", "security+", "pmp", "scrum master", "aws certified", "azure fundamentals",
    "cpa", "rn", "shrm", "six sigma", "comptia", "ccna", "cisa",
}

TOOLS = {
    "aws", "amazon web services", "azure", "gcp", "google cloud", "kubernetes", "docker",
    "terraform", "ansible", "jenkins", "github", "gitlab", "jira", "servicenow", "salesforce",
    "tableau", "power bi", "excel", "sql", "postgresql", "mysql", "mongodb", "react", "angular",
    "vue", "node", "python", "java", "typescript", "javascript", "linux", "splunk", "siem",
}

HARD_SKILLS = {
    "api", "apis", "architecture", "automation", "backend", "budgeting", "cloud", "compliance",
    "cybersecurity", "data analysis", "devops", "etl", "forecasting", "frontend", "incident response",
    "machine learning", "microservices", "networking", "project management", "reliability",
    "risk management", "security", "software engineering", "systems design", "testing",
}

SKILL_ALIASES = {
    "amazon web services": "AWS",
    "aws": "AWS",
    "google cloud": "GCP",
    "gcp": "GCP",
    "javascript": "JavaScript",
    "node": "Node.js",
    "nodejs": "Node.js",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "powerbi": "Power BI",
    "power bi": "Power BI",
    "typescript": "TypeScript",
}

SECTION_NAMES = ("summary", "skills", "experience", "education")
JOB_STATUSES = ("saved", "applied", "interview", "offer", "rejected")


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\u00a0", " ")).strip()


def _walk_text(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [_clean(value)] if _clean(value) else []
    if isinstance(value, (int, float, bool)):
        return [_clean(value)]
    if isinstance(value, list):
        return [text for item in value for text in _walk_text(item)]
    if isinstance(value, dict):
        texts: list[str] = []
        for key, item in value.items():
            if str(key).lower() in {"data", "filedata", "profileimagedata", "legacyprofileimagedata"}:
                continue
            texts.extend(_walk_text(item))
        return texts
    return []


def resume_to_text(resume: dict[str, Any], *, redact_pii: bool = False) -> str:
    lines: list[str] = []
    personal = resume.get("personalDetails") if isinstance(resume.get("personalDetails"), dict) else {}
    name = " ".join(part for part in [_clean(personal.get("firstName")), _clean(personal.get("lastName"))] if part)
    if name:
        lines.append("[REDACTED NAME]" if redact_pii else name)
    contact = []
    for key, label in (("email", "Email"), ("phone", "Phone"), ("links", "Links")):
        value = _clean(personal.get(key))
        if value:
            contact.append(f"{label}: {'[REDACTED]' if redact_pii and key in {'email', 'phone'} else value}")
    if contact:
        lines.append(" | ".join(contact))
    if _clean(personal.get("summary")):
        lines.extend(["", "PROFESSIONAL SUMMARY", _clean(personal.get("summary"))])
    if resume.get("skillItems"):
        lines.extend(["", "SKILLS"])
        for item in resume.get("skillItems") or []:
            if isinstance(item, dict):
                category = _clean(item.get("category")) or "Skills"
                values = _clean(item.get("items"))
                if values:
                    lines.append(f"{category}: {values}")
    if resume.get("experienceItems"):
        lines.extend(["", "PROFESSIONAL EXPERIENCE"])
        for item in resume.get("experienceItems") or []:
            if isinstance(item, dict):
                heading = " - ".join(part for part in [_clean(item.get("role")), _clean(item.get("company")), _clean(item.get("dates"))] if part)
                if heading:
                    lines.append(heading)
                description = _clean(item.get("description")).replace(" - ", "\n- ")
                if description:
                    lines.extend(line.strip() for line in description.splitlines() if line.strip())
    if resume.get("educationItems"):
        lines.extend(["", "EDUCATION"])
        for item in resume.get("educationItems") or []:
            if isinstance(item, dict):
                line = " - ".join(part for part in [_clean(item.get("degree")), _clean(item.get("school")), _clean(item.get("location")), _clean(item.get("dates"))] if part)
                if line:
                    lines.append(line)
    if resume.get("additionalSections"):
        for item in resume.get("additionalSections") or []:
            if isinstance(item, dict):
                title = _clean(item.get("title"))
                values = _clean(item.get("items"))
                if title and values:
                    lines.extend(["", title.upper(), values])
    return "\n".join(lines).strip()


def _contains(text: str, term: str) -> bool:
    pattern = r"(?<![a-z0-9+#.])" + re.escape(term.lower()) + r"(?![a-z0-9+#.])"
    return re.search(pattern, text.lower()) is not None


def _extract_terms(text: str, vocabulary: set[str]) -> list[str]:
    found = []
    for term in sorted(vocabulary, key=lambda item: (-len(item), item)):
        if _contains(text, term):
            found.append(SKILL_ALIASES.get(term.lower(), term.title() if term.islower() else term))
    return sorted(dict.fromkeys(found), key=str.lower)


def normalize_skills(values: list[str]) -> dict[str, Any]:
    normalized: list[str] = []
    duplicates: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = _clean(value).strip(" ,;")
        if not cleaned:
            continue
        key = re.sub(r"[^a-z0-9+#.]+", " ", cleaned.lower()).strip()
        label = SKILL_ALIASES.get(key, cleaned)
        normalized_key = label.lower()
        if normalized_key in seen:
            duplicates.append(cleaned)
        else:
            normalized.append(label)
            seen.add(normalized_key)
    return {"normalized": normalized, "duplicates": duplicates}


def parse_job_description(text: str, job_url: str | None = None) -> dict[str, Any]:
    clean_text = _clean(text)
    lines = [_clean(line) for line in text.splitlines() if _clean(line)]
    title = ""
    company = ""
    location = ""
    salary = ""

    for line in lines[:12]:
        if re.search(r"\b(engineer|architect|analyst|manager|director|developer|consultant|specialist|lead|administrator|designer)\b", line, re.I):
            title = re.sub(r"\s*[-|]\s*(remote|hybrid|onsite|full.?time|part.?time).*$", "", line, flags=re.I)[:200]
            break
    for line in lines[:20]:
        match = re.search(r"^(company|employer|organization)\s*[:\-]\s*(.+)$", line, re.I)
        if match:
            company = match.group(2)[:200]
        match = re.search(r"^(location|work location)\s*[:\-]\s*(.+)$", line, re.I)
        if match:
            location = match.group(2)[:200]
        match = re.search(r"(\$[0-9][0-9,]*(?:\s*-\s*\$?[0-9][0-9,]*)?(?:\s*/\s*(?:year|yr|hour|hr))?)", line, re.I)
        if match:
            salary = match.group(1)
    if not location:
        remote = re.search(r"\b(remote|hybrid|onsite)\b", clean_text, re.I)
        if remote:
            location = remote.group(1).title()

    responsibilities = _job_lines(text, ("responsib", "what you", "you will", "build", "design", "manage", "lead", "deliver"))
    requirements = _job_lines(text, ("require", "qualification", "experience", "must", "preferred", "skill", "degree"))
    return {
        "title": title or "Target Role",
        "company": company or None,
        "location": location or None,
        "salary": salary or None,
        "jobUrl": job_url,
        "responsibilities": responsibilities[:8],
        "requirements": requirements[:8],
        "keywords": {
            "hardSkills": _extract_terms(clean_text, HARD_SKILLS),
            "softSkills": _extract_terms(clean_text, SOFT_SKILLS),
            "tools": _extract_terms(clean_text, TOOLS),
            "certifications": _extract_terms(clean_text, CERTIFICATIONS),
        },
    }


def _job_lines(text: str, hints: tuple[str, ...]) -> list[str]:
    lines = []
    for raw in text.splitlines():
        line = re.sub(r"^\s*[-*\u2022]\s*", "", _clean(raw))
        if 20 <= len(line) <= 260 and any(hint in line.lower() for hint in hints):
            lines.append(line)
    return lines


def _section_text(resume: dict[str, Any], section: str) -> str:
    if section == "summary":
        personal = resume.get("personalDetails") if isinstance(resume.get("personalDetails"), dict) else {}
        return _clean(personal.get("summary"))
    if section == "skills":
        return " ".join(_walk_text(resume.get("skillItems")))
    if section == "experience":
        return " ".join(_walk_text(resume.get("experienceItems")))
    if section == "education":
        return " ".join(_walk_text(resume.get("educationItems")))
    return ""


def _bullet_lines(resume: dict[str, Any]) -> list[str]:
    bullets: list[str] = []
    for item in resume.get("experienceItems") or []:
        if not isinstance(item, dict):
            continue
        for line in str(item.get("description") or "").splitlines():
            clean = re.sub(r"^\s*[-*\u2022]\s*", "", _clean(line))
            if clean:
                bullets.append(clean)
    return bullets


def bullet_quality(resume: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for bullet in _bullet_lines(resume):
        first = re.sub(r"[^A-Za-z]", "", bullet.split(" ")[0]).lower() if bullet.split(" ") else ""
        checks = {
            "actionVerb": first in ACTION_VERBS,
            "metric": bool(re.search(r"\b\d+[%+x]?\b|\$[0-9]", bullet)),
            "scope": bool(re.search(r"\b(team|users|customers|systems|platforms|applications|revenue|cost|pipeline|region|global)\b", bullet, re.I)),
            "impact": bool(re.search(r"\b(improved|reduced|increased|saved|accelerated|delivered|enabled|grew|lowered|raised|launched|optimized)\b", bullet, re.I)),
        }
        rows.append({"text": bullet, "score": round(sum(checks.values()) / 4 * 100), "checks": checks})
    average = round(sum(item["score"] for item in rows) / len(rows)) if rows else 0
    return {"averageScore": average, "bullets": rows[:30]}


def risk_scan(resume: dict[str, Any]) -> dict[str, Any]:
    risks: list[dict[str, str]] = []
    personal = resume.get("personalDetails") if isinstance(resume.get("personalDetails"), dict) else {}
    if not _clean(personal.get("email")):
        risks.append({"severity": "high", "item": "Missing email", "fix": "Add a professional email address."})
    if not _clean(personal.get("phone")):
        risks.append({"severity": "medium", "item": "Missing phone", "fix": "Add a phone number if appropriate for your region."})
    if resume.get("profileImageData") or resume.get("profileImageUrl"):
        risks.append({"severity": "medium", "item": "Profile photo included", "fix": "Use photo-free ATS exports for US applications unless requested."})
    if not resume.get("experienceItems"):
        risks.append({"severity": "high", "item": "Missing work experience", "fix": "Add at least one role or project experience entry."})
    for item in resume.get("experienceItems") or []:
        if isinstance(item, dict) and not _clean(item.get("dates")):
            risks.append({"severity": "medium", "item": f"Unreadable/missing dates for {_clean(item.get('role')) or 'experience'}", "fix": "Use a clear range such as Jan 2022 - Present."})
    if "|" in resume_to_text(resume) and len(resume_to_text(resume).split("|")) > 8:
        risks.append({"severity": "low", "item": "Possible table-like formatting", "fix": "Use the ATS-safe text export before applying."})
    return {"risks": risks, "score": max(0, 100 - sum({"high": 22, "medium": 12, "low": 6}.get(r["severity"], 6) for r in risks))}


def completeness_score(resume: dict[str, Any]) -> dict[str, Any]:
    checks = [
        ("Name", bool(_clean((resume.get("personalDetails") or {}).get("firstName")) or _clean((resume.get("personalDetails") or {}).get("lastName")))),
        ("Email", bool(_clean((resume.get("personalDetails") or {}).get("email")))),
        ("Summary", bool(_section_text(resume, "summary"))),
        ("Experience", bool(resume.get("experienceItems"))),
        ("Education", bool(resume.get("educationItems"))),
        ("Skills", bool(resume.get("skillItems"))),
        ("Metrics in bullets", any(re.search(r"\d", bullet) for bullet in _bullet_lines(resume))),
        ("Links or portfolio", bool(_clean((resume.get("personalDetails") or {}).get("links")))),
    ]
    passed = sum(1 for _, ok in checks if ok)
    return {"score": round(passed / len(checks) * 100), "checks": [{"label": label, "passed": ok} for label, ok in checks]}


def analyze_resume_against_job(resume: dict[str, Any], job_description: str, job_url: str | None = None, *, country: str = "US", language: str = "en") -> dict[str, Any]:
    resume_text = resume_to_text(resume)
    job = parse_job_description(job_description, job_url)
    all_job_terms = sorted({term for group in job["keywords"].values() for term in group}, key=str.lower)
    included = [term for term in all_job_terms if _contains(resume_text, term)]
    missing = [term for term in all_job_terms if term not in included]

    section_matches = []
    for section in SECTION_NAMES:
        section_value = _section_text(resume, section)
        matched = [term for term in all_job_terms if _contains(section_value, term)]
        section_matches.append({
            "section": section,
            "matched": matched,
            "missing": [term for term in all_job_terms if term not in matched][:12],
            "score": round(len(matched) / max(1, len(all_job_terms)) * 100),
        })

    quality = bullet_quality(resume)
    risks = risk_scan(resume)
    completeness = completeness_score(resume)
    keyword_score = round(len(included) / max(1, len(all_job_terms)) * 100)
    section_score = round(sum(item["score"] for item in section_matches) / max(1, len(section_matches)))
    ats_score = round(keyword_score * 0.38 + section_score * 0.2 + quality["averageScore"] * 0.22 + risks["score"] * 0.1 + completeness["score"] * 0.1)
    skill_values = []
    for item in resume.get("skillItems") or []:
        if isinstance(item, dict):
            skill_values.extend(re.split(r"[,;\n|]", str(item.get("items") or "")))
    normalized_skills = normalize_skills(skill_values)

    return {
        "noLlmCalls": True,
        "privacyBadge": "No LLM calls: deterministic local rules only",
        "atsScore": max(0, min(100, ats_score)),
        "job": job,
        "missingKeywords": {
            "all": missing,
            "hardSkills": [term for term in job["keywords"]["hardSkills"] if term not in included],
            "softSkills": [term for term in job["keywords"]["softSkills"] if term not in included],
            "tools": [term for term in job["keywords"]["tools"] if term not in included],
            "certifications": [term for term in job["keywords"]["certifications"] if term not in included],
        },
        "includedKeywords": included,
        "sectionMatches": section_matches,
        "bulletQuality": quality,
        "riskScan": risks,
        "completeness": completeness,
        "skillTaxonomy": normalized_skills,
        "readyToApplyChecklist": ready_checklist(ats_score, missing, risks, completeness),
        "linkedinChecklist": linkedin_checklist(resume),
        "templates": deterministic_templates(job, resume),
        "countryFormat": country_format(country),
        "languageWorkflow": language_workflow(language),
        "publicProfile": public_profile_plan(resume),
        "exportsPreview": {"atsText": resume_to_text(resume, redact_pii=False)[:5000]},
        "featureCoverage": feature_catalog(),
    }


def ready_checklist(score: int, missing: list[str], risks: dict[str, Any], completeness: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"label": "ATS score is 75 or higher", "passed": score >= 75},
        {"label": "No high severity resume risks", "passed": not any(r["severity"] == "high" for r in risks["risks"])},
        {"label": "Missing keyword list reviewed", "passed": len(missing) <= 8},
        {"label": "Resume completeness is 85 or higher", "passed": completeness["score"] >= 85},
        {"label": "Use ATS-safe text/PDF export", "passed": True},
    ]


def linkedin_checklist(resume: dict[str, Any]) -> list[dict[str, Any]]:
    personal = resume.get("personalDetails") if isinstance(resume.get("personalDetails"), dict) else {}
    return [
        {"label": "Headline matches target role", "passed": bool(_clean(resume.get("targetRole")))},
        {"label": "About section mirrors resume summary", "passed": len(_clean(personal.get("summary"))) >= 80},
        {"label": "Featured section includes portfolio or resume website", "passed": bool(_clean(personal.get("links")))},
        {"label": "Experience bullets include measurable outcomes", "passed": any(re.search(r"\d", bullet) for bullet in _bullet_lines(resume))},
        {"label": "Skills include normalized top tools", "passed": bool(resume.get("skillItems"))},
    ]


def deterministic_templates(job: dict[str, Any], resume: dict[str, Any]) -> dict[str, str]:
    role = job.get("title") or _clean(resume.get("targetRole")) or "the role"
    company = job.get("company") or "your team"
    return {
        "followUpEmail": f"Hello,\n\nI wanted to follow up on my application for the {role} role. I remain interested in {company} and would welcome the chance to discuss how my background maps to the team's needs.\n\nBest,\n[YOUR NAME]",
        "thankYouEmail": f"Hello,\n\nThank you for taking the time to speak with me about the {role} role. I appreciated learning more about the priorities for the team and remain excited about the opportunity.\n\nBest,\n[YOUR NAME]",
        "recruiterMessage": f"Hello, I am interested in the {role} role and would be glad to share how my experience aligns with the requirements. Is this position still active?",
        "referralRequest": f"Hello,\n\nI noticed an opening for {role} at {company}. If you are comfortable, would you be open to referring me or pointing me to the right recruiter?",
        "salaryNegotiation": f"Thank you for the offer. Based on the role scope, market expectations, and my relevant experience, I would like to discuss whether there is flexibility in the compensation package.",
        "starAnswer": "Situation: [brief context]\nTask: [your responsibility]\nAction: [specific steps you took]\nResult: [metric or business outcome]",
        "first90DayPlan": "First 30 days: learn systems, stakeholders, goals.\nDays 31-60: deliver early wins and document gaps.\nDays 61-90: own a measurable initiative and establish operating rhythm.",
    }


def country_format(country: str | None) -> dict[str, Any]:
    key = (country or "US").upper()
    formats = {
        "US": {"photo": False, "personalDetails": "Keep address optional; city/state is enough.", "pages": "1-2 pages"},
        "CA": {"photo": False, "personalDetails": "City/province is enough.", "pages": "1-2 pages"},
        "EU": {"photo": "varies", "personalDetails": "Follow local CV norms.", "pages": "1-3 pages"},
        "UK": {"photo": False, "personalDetails": "Do not include age, marital status, or photo.", "pages": "1-2 pages"},
    }
    return formats.get(key, formats["US"]) | {"country": key}


def language_workflow(language: str | None) -> dict[str, Any]:
    return {
        "targetLanguage": language or "en",
        "mode": "manual_translation_workflow",
        "steps": [
            "Export ATS-safe text.",
            "Translate section by section with a human-approved translation source.",
            "Re-import translated text as a new resume version.",
            "Run the deterministic completeness and risk checks again.",
        ],
    }


def public_profile_plan(resume: dict[str, Any]) -> dict[str, Any]:
    links = _clean((resume.get("personalDetails") or {}).get("links"))
    return {
        "shareLinksSupported": True,
        "qrPayload": links or "Create a private/public resume share link first.",
        "piiRedactionSupported": True,
        "websiteSections": ["Summary", "Experience", "Projects", "Skills", "Contact"],
    }


def _docx_base64(text: str) -> str:
    paragraphs = "".join(f"<w:p><w:r><w:t>{escape(line)}</w:t></w:r></w:p>" for line in text.splitlines())
    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{paragraphs}</w:body></w:document>"""
    buffer = io.BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>""")
        docx.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>""")
        docx.writestr("word/document.xml", document_xml)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf_base64(text: str) -> str:
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    page_refs: list[str] = []
    for page_lines in [text.splitlines()[i:i + 45] for i in range(0, len(text.splitlines()) or 1, 45)]:
        commands = ["BT /F1 10 Tf 1 0 0 1 54 790 Tm"]
        y = 790
        for raw in page_lines:
            for line in textwrap.wrap(raw, width=92) or [""]:
                commands.append(f"1 0 0 1 54 {y} Tm ({_pdf_escape(line)}) Tj")
                y -= 15
        commands.append("ET")
        stream = "\n".join(commands).encode("latin-1", errors="replace")
        objects.append(b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream")
        content_object = len(objects)
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_object} 0 R >>".encode("ascii"))
        page_refs.append(f"{len(objects)} 0 R")
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(page_refs)}] /Count {len(page_refs)} >>".encode("ascii")
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    xref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode("ascii"))
    return base64.b64encode(bytes(pdf)).decode("ascii")


def create_resume_exports(resume: dict[str, Any], title: str | None = None, public_url: str | None = None, *, redact_pii: bool = False) -> dict[str, Any]:
    text = resume_to_text(resume, redact_pii=redact_pii)
    if public_url:
        text = f"{text}\n\nPUBLIC PROFILE\n{public_url}".strip()
    pdf = _pdf_base64(text)
    return {
        "title": title or "resume",
        "txtBase64": base64.b64encode(text.encode("utf-8")).decode("ascii"),
        "atsText": text,
        "docxBase64": _docx_base64(text),
        "pdfBase64": pdf,
        "pdfValidation": {"selectableText": True, "imageOnly": False, "method": "Generated with PDF text operators"},
        "qrPayload": public_url or "",
        "redactPii": redact_pii,
    }


def import_linkedin_profile(profile_text: str) -> dict[str, Any]:
    lines = [_clean(line) for line in profile_text.splitlines() if _clean(line)]
    name = lines[0] if lines else ""
    headline = lines[1] if len(lines) > 1 else ""
    skills = []
    for line in lines:
        if line.lower().startswith("skills"):
            skills.extend(part.strip() for part in re.split(r"[,;|]", line.split(":", 1)[-1]) if part.strip())
    resume = {
        "targetRole": headline,
        "personalDetails": {"firstName": name.split(" ")[0] if name else "", "lastName": " ".join(name.split(" ")[1:]), "summary": headline, "email": "", "phone": "", "links": "", "address": "", "city": "", "state": "", "country": "", "postalCode": ""},
        "skillItems": [{"id": "linkedin-skills", "category": "LinkedIn Skills", "items": ", ".join(normalize_skills(skills)["normalized"])}] if skills else [],
        "experienceItems": [],
        "educationItems": [],
        "additionalSections": [{"id": "linkedin-import", "title": "LinkedIn Import Notes", "items": "\n".join(lines[2:20])}],
    }
    return {"resume": resume, "checklist": linkedin_checklist(resume), "warnings": ["Review imported text before saving. LinkedIn import is deterministic and text-based."]}


def feature_catalog() -> list[dict[str, Any]]:
    groups = {
        "ATS and Resume Quality": ["ATS score", "Missing keyword detector", "Section-level match report", "Bullet quality checker", "Resume risk scanner", "Resume completeness score", "Accessibility checks"],
        "Documents and Versions": ["Base resume and tailored versions", "Version history and restore", "Bullet toggles per job", "Achievement library", "PDF/DOCX/TXT/ATS text exports", "Selectable PDF validation", "Multi-language version workflow", "Country-specific formats"],
        "Job Search CRM": ["Job tracker Kanban", "Application reminders", "Analytics", "Contact CRM", "Application packets", "Saved repeated answers", "CSV import/export plan"],
        "Profile and Sharing": ["LinkedIn import", "LinkedIn optimizer checklist", "Personal resume website shares", "QR payloads", "PII redaction", "Data export/delete controls"],
        "Business and Admin": ["Admin dashboards", "Review comments workflow", "Career-coach workflow", "University mode", "Team templates", "White-label configuration", "Parser API", "Webhooks", "Template marketplace", "Professional review add-on", "Resume audit purchase", "Subscription entitlements", "Referral program", "SEO content hub"],
        "Browser Extension": ["Job clipper manifest plan", "Autofill profile schema", "Supported-sites mapping plan"],
    }
    features = []
    for group, names in groups.items():
        for name in names:
            features.append({"group": group, "name": name, "operation": "deterministic", "llmCalls": False})
    return features


def analytics_for_jobs(jobs: list[Any]) -> dict[str, Any]:
    total = len(jobs)
    by_status = Counter(getattr(job, "status", "saved") for job in jobs)
    applied = sum(by_status.get(status, 0) for status in ("applied", "interview", "offer", "rejected"))
    interviews = by_status.get("interview", 0) + by_status.get("offer", 0)
    offers = by_status.get("offer", 0)
    today = date.today()
    this_week = sum(1 for job in jobs if getattr(job, "created_at", None) and (today - job.created_at.date()).days <= 7)
    return {
        "total": total,
        "byStatus": {status: by_status.get(status, 0) for status in JOB_STATUSES},
        "applicationsThisWeek": this_week,
        "responseRate": round(interviews / max(1, applied) * 100),
        "interviewConversion": round(interviews / max(1, total) * 100),
        "offerRate": round(offers / max(1, applied) * 100),
        "generatedAt": datetime.now(UTC).isoformat(),
    }


def default_packet(job: dict[str, Any], resume_id: str | None, cover_letter_id: str | None, notes: str | None) -> dict[str, Any]:
    return {
        "resumeId": resume_id,
        "coverLetterId": cover_letter_id,
        "jobTitle": job.get("title"),
        "company": job.get("company"),
        "jobDescription": job.get("jobDescription", ""),
        "notes": notes or "",
        "documents": ["resume", "coverLetter", "jobDescription", "notes"],
    }


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "resume"
