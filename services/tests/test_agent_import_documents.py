from __future__ import annotations

import base64
import json
from io import BytesIO
from zipfile import ZipFile


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_MIME = "application/pdf"


class _FakeGeminiResponse:
    text = """RESUME_JSON:
{"header":{"name":"Alex Resume","title":"Engineer","location":"","phone":"","email":"","links":[]},"summary":"","skills":{"core":[],"tools":[],"cloud":[],"data":[],"other":[]},"experience":[],"projects":[],"education":[],"certifications":[],"awards":[],"publications":[]}

GAP_AND_FIX_LIST:
N/A

RESUME_ATS:
N/A

RESUME_HUMAN:
N/A

RESUME_TARGETED:
N/A

RESUME_WITH_PHOTO:
N/A

COVER_LETTER_FULL:
N/A - no job description provided

COVER_LETTER_SHORT:
N/A - no job description provided

COLD_EMAIL:
N/A - no job description provided"""


class _FakeGeminiModels:
    def __init__(self):
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return _FakeGeminiResponse()


class _FakeGeminiClient:
    def __init__(self):
        self.models = _FakeGeminiModels()


class _FailingGeminiModels:
    def __init__(self):
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        raise RuntimeError("Gemini unavailable")


class _FailingGeminiClient:
    def __init__(self):
        self.models = _FailingGeminiModels()


def _signup(client) -> str:
    response = client.post(
        "/auth/signup",
        json={"name": "Import User", "email": "import@example.com", "password": "secret123", "plan": "free"},
    )
    assert response.status_code == 201, response.text
    return response.json()["token"]


def _docx_bytes(text: str) -> bytes:
    body = "".join(f"<w:p><w:r><w:t>{part}</w:t></w:r></w:p>" for part in text.splitlines())
    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>{body}</w:body>
</w:document>"""

    buffer = BytesIO()
    with ZipFile(buffer, "w") as docx:
        docx.writestr("[Content_Types].xml", "")
        docx.writestr("word/document.xml", document_xml)
    return buffer.getvalue()


def _pdf_bytes(lines: list[str]) -> bytes:
    def escape_pdf_text(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    content = "BT\n/F1 12 Tf\n72 760 Td\n"
    for index, line in enumerate(lines):
        prefix = "" if index == 0 else "0 -18 Td "
        content += f"{prefix}({escape_pdf_text(line)}) Tj\n"
    content += "ET\n"
    stream = content.encode("latin-1")

    objects: list[bytes] = []

    def add_object(value: str | bytes) -> None:
        objects.append(value if isinstance(value, bytes) else value.encode("latin-1"))

    add_object("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    add_object("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
    add_object(
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
    )
    add_object("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")
    add_object(b"5 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" + stream + b"endstream endobj\n")

    output = BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets: list[int] = []
    for obj in objects:
        offsets.append(output.tell())
        output.write(obj)
    xref = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("latin-1"))
    for offset in offsets:
        output.write(f"{offset:010d} 00000 n \n".encode("latin-1"))
    output.write(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("latin-1"))
    return output.getvalue()


def test_generate_resume_extracts_docx_text_before_ai_parse(client, monkeypatch):
    token = _signup(client)
    fake_client = _FakeGeminiClient()
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: fake_client)

    resume_bytes = _docx_bytes("Alex Resume\nSenior Python Engineer\nBuilt APIs")
    encoded_resume = base64.b64encode(resume_bytes).decode("ascii")
    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": DOCX_MIME,
                    "name": "alex-resume.docx",
                    "data": encoded_resume,
                }
            },
        },
    )

    assert response.status_code == 200, response.text
    contents = fake_client.models.calls[0]["contents"]
    joined = "\n".join(part for part in contents if isinstance(part, str))
    assert "EXTRACTED_RESUME_TEXT_FROM_WORD_DOCUMENT" in joined
    assert "UNDERSTOOD_RESUME_JSON_FOR_TEMPLATE_FIELDS" in joined
    assert "Alex Resume" in joined
    assert "Senior Python Engineer" in joined
    assert encoded_resume not in joined
    assert '"textExtracted": true' in joined
    assert '"name": "alex-resume.docx"' in joined
    assert '"parsedResumeJson"' in joined


def test_generate_resume_uses_understood_pdf_json_when_ai_json_is_weak(client, monkeypatch):
    token = _signup(client)
    fake_client = _FakeGeminiClient()
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: fake_client)

    resume_bytes = _pdf_bytes([
        "Morgan Smart",
        "Software Architect",
        "morgan@example.com | Atlanta, GA",
        "SUMMARY",
        "Architect focused on AI delivery and platform modernization.",
        "SKILLS",
        "Python, AWS, Architecture",
        "EXPERIENCE",
        "Software Architect, Slalom, Atlanta GA, Jan 2022 - Present",
        "Led AI engineering enablement for delivery teams.",
    ])

    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": PDF_MIME,
                    "name": "morgan-resume.pdf",
                    "data": base64.b64encode(resume_bytes).decode("ascii"),
                }
            },
        },
    )

    assert response.status_code == 200, response.text

    contents = fake_client.models.calls[0]["contents"]
    joined = "\n".join(part for part in contents if isinstance(part, str))
    assert "EXTRACTED_RESUME_TEXT_FROM_PDF" in joined
    assert "UNDERSTOOD_RESUME_JSON_FOR_TEMPLATE_FIELDS" in joined
    assert joined.index("EXTRACTED_RESUME_TEXT_FROM_PDF") < joined.index("UNDERSTOOD_RESUME_JSON_FOR_TEMPLATE_FIELDS")

    text = response.json()["text"]
    json_blob = text.split("RESUME_JSON:", 1)[1].split("GAP_AND_FIX_LIST:", 1)[0].strip()
    resume_json = json.loads(json_blob)

    assert resume_json["header"]["name"] == "Morgan Smart"
    assert resume_json["header"]["title"] == "Software Architect"
    assert resume_json["summary"] == "Architect focused on AI delivery and platform modernization."
    assert resume_json["skills"]["core"] == ["Python", "AWS", "Architecture"]
    assert resume_json["experience"][0]["role"] == "Software Architect"
    assert resume_json["experience"][0]["company"] == "Slalom"
    assert resume_json["experience"][0]["start"] == "Jan 2022"
    assert resume_json["experience"][0]["end"] == "Present"
    assert [item["bullet"] for item in resume_json["experience"][0]["highlights"]] == [
        "Led AI engineering enablement for delivery teams."
    ]


def test_generate_resume_rejects_unsupported_import_file_type(client):
    token = _signup(client)
    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": "image/png",
                    "name": "resume.png",
                    "data": base64.b64encode(b"not-a-resume").decode("ascii"),
                }
            },
        },
    )

    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Supported import formats: PDF, DOC, DOCX."


def test_generate_resume_rejects_unreadable_docx_before_ai_parse(client, monkeypatch):
    token = _signup(client)
    fake_client = _FakeGeminiClient()
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: fake_client)

    empty_docx = _docx_bytes("")
    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": DOCX_MIME,
                    "name": "empty.docx",
                    "data": base64.b64encode(empty_docx).decode("ascii"),
                }
            },
        },
    )

    assert response.status_code == 422, response.text
    assert "Could not extract readable text" in response.json()["detail"]
    assert fake_client.models.calls == []


def test_generate_resume_falls_back_to_local_import_parser_when_ai_fails(client, monkeypatch):
    token = _signup(client)
    fake_client = _FailingGeminiClient()
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: fake_client)

    resume_bytes = _docx_bytes(
        "\n".join([
            "Alex Resume",
            "Senior Python Engineer",
            "alex@example.com",
            "SUMMARY",
            "Backend engineer building APIs.",
            "SKILLS",
            "Python, FastAPI, SQL",
            "EXPERIENCE",
            "Built APIs for internal users",
        ])
    )
    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": DOCX_MIME,
                    "name": "alex-resume.docx",
                    "data": base64.b64encode(resume_bytes).decode("ascii"),
                }
            },
        },
    )

    assert response.status_code == 200, response.text
    assert len(fake_client.models.calls) == 1

    text = response.json()["text"]
    assert "Imported with local parser because AI generation was unavailable" in text
    json_blob = text.split("RESUME_JSON:", 1)[1].split("GAP_AND_FIX_LIST:", 1)[0].strip()
    resume_json = json.loads(json_blob)

    assert resume_json["header"]["name"] == "Alex Resume"
    assert resume_json["header"]["title"] == "Senior Python Engineer"
    assert resume_json["header"]["email"] == "alex@example.com"
    assert "Python" in resume_json["skills"]["core"]
    assert resume_json["experience"][0]["highlights"][0]["bullet"] == "Built APIs for internal users"


def test_generate_resume_parses_pdf_resume_into_editor_fields_when_ai_fails(client, monkeypatch):
    token = _signup(client)
    fake_client = _FailingGeminiClient()
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: fake_client)

    resume_bytes = _pdf_bytes([
        "Alex Resume",
        "Senior Python Engineer",
        "alex@example.com | (555) 010-0200 | Austin, TX",
        "SUMMARY",
        "Backend engineer building reliable APIs.",
        "SKILLS",
        "\x7f, Python, FastAPI, SQL",
        "EXPERIENCE",
        "Senior Python Engineer - Acme Corp",
        "Jan 2020 - Present",
        "Built APIs for internal users",
        "Reduced latency by 35%",
        "EDUCATION",
        "State University",
        "BS Computer Science",
    ])
    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": PDF_MIME,
                    "name": "alex-resume.pdf",
                    "data": base64.b64encode(resume_bytes).decode("ascii"),
                }
            },
        },
    )

    assert response.status_code == 200, response.text

    text = response.json()["text"]
    json_blob = text.split("RESUME_JSON:", 1)[1].split("GAP_AND_FIX_LIST:", 1)[0].strip()
    resume_json = json.loads(json_blob)

    assert resume_json["header"]["name"] == "Alex Resume"
    assert resume_json["header"]["title"] == "Senior Python Engineer"
    assert resume_json["header"]["email"] == "alex@example.com"
    assert resume_json["header"]["phone"] == "(555) 010-0200"
    assert resume_json["header"]["location"] == "Austin, TX"
    assert resume_json["summary"] == "Backend engineer building reliable APIs."
    assert resume_json["skills"]["core"] == ["Python", "FastAPI", "SQL"]
    assert resume_json["experience"][0]["role"] == "Senior Python Engineer"
    assert resume_json["experience"][0]["company"] == "Acme Corp"
    assert resume_json["experience"][0]["start"] == "Jan 2020"
    assert resume_json["experience"][0]["end"] == "Present"
    assert [item["bullet"] for item in resume_json["experience"][0]["highlights"]] == [
        "Built APIs for internal users",
        "Reduced latency by 35%",
    ]
    assert resume_json["education"][0]["school"] == "State University"
    assert resume_json["education"][0]["degree"] == "BS Computer Science"


def test_generate_resume_parses_compact_pdf_rows_into_structured_fields(client, monkeypatch):
    token = _signup(client)
    fake_client = _FailingGeminiClient()
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: fake_client)

    resume_bytes = _pdf_bytes([
        "Jordan Candidate",
        "Software Architect",
        "jordan@example.com | 555-555-0100 | Seattle, WA 98101",
        "PROFESSIONAL PROFILE",
        "Architect focused on AI-enabled delivery and cloud modernization.",
        "CORE COMPETENCIES",
        "Cloud Architecture | AI Engineering | Python | AWS",
        "WORK EXPERIENCE",
        "Software Architect, Slalom, Seattle WA, Jan 2022 - Present",
        "Led AI accelerated engineering assessments for enterprise teams.",
        "Senior Engineer at Acme Corp | 2018 - 2021",
        "Built resilient API platforms for customer-facing products.",
        "EDUCATION",
        "State University | BS Computer Science | 2012 - 2016",
    ])

    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": PDF_MIME,
                    "name": "jordan-resume.pdf",
                    "data": base64.b64encode(resume_bytes).decode("ascii"),
                }
            },
        },
    )

    assert response.status_code == 200, response.text
    text = response.json()["text"]
    json_blob = text.split("RESUME_JSON:", 1)[1].split("GAP_AND_FIX_LIST:", 1)[0].strip()
    resume_json = json.loads(json_blob)

    assert resume_json["header"]["name"] == "Jordan Candidate"
    assert resume_json["header"]["title"] == "Software Architect"
    assert resume_json["summary"] == "Architect focused on AI-enabled delivery and cloud modernization."
    assert resume_json["skills"]["core"] == ["Cloud Architecture", "AI Engineering", "Python", "AWS"]
    assert resume_json["experience"][0]["role"] == "Software Architect"
    assert resume_json["experience"][0]["company"] == "Slalom"
    assert resume_json["experience"][0]["location"] == "Seattle WA"
    assert resume_json["experience"][0]["start"] == "Jan 2022"
    assert resume_json["experience"][0]["end"] == "Present"
    assert resume_json["experience"][1]["role"] == "Senior Engineer"
    assert resume_json["experience"][1]["company"] == "Acme Corp"
    assert resume_json["experience"][1]["start"] == "2018"
    assert resume_json["experience"][1]["end"] == "2021"
    assert resume_json["education"][0]["school"] == "State University"
    assert resume_json["education"][0]["degree"] == "BS Computer Science"
    assert resume_json["education"][0]["start"] == "2012"
    assert resume_json["education"][0]["end"] == "2016"


def test_generate_resume_parses_multiline_pdf_job_details(client, monkeypatch):
    token = _signup(client)
    fake_client = _FailingGeminiClient()
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: fake_client)

    resume_bytes = _pdf_bytes([
        "Taylor Builder",
        "Principal Architect",
        "taylor@example.com | Denver, CO",
        "EXPERIENCE",
        "Contoso Ltd",
        "New York, NY",
        "Principal Architect",
        "Mar 2021 - Present",
        "Owned cloud modernization strategy across product teams.",
        "Senior Engineer",
        "Fabrikam Inc",
        "Remote",
        "2018 - 2021",
        "Built resilient internal platform services.",
        "Northwind Partners | Chicago, IL",
        "QA Automation Lead",
        "2016 - 2018",
        "Reduced regression testing cycle time.",
    ])

    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": PDF_MIME,
                    "name": "taylor-resume.pdf",
                    "data": base64.b64encode(resume_bytes).decode("ascii"),
                }
            },
        },
    )

    assert response.status_code == 200, response.text
    text = response.json()["text"]
    json_blob = text.split("RESUME_JSON:", 1)[1].split("GAP_AND_FIX_LIST:", 1)[0].strip()
    resume_json = json.loads(json_blob)

    assert resume_json["experience"][0] == {
        "company": "Contoso Ltd",
        "role": "Principal Architect",
        "location": "New York, NY",
        "start": "Mar 2021",
        "end": "Present",
        "highlights": [
            {
                "bullet": "Owned cloud modernization strategy across product teams.",
                "tags": [],
                "metrics": [],
            }
        ],
    }
    assert resume_json["experience"][1] == {
        "company": "Fabrikam Inc",
        "role": "Senior Engineer",
        "location": "Remote",
        "start": "2018",
        "end": "2021",
        "highlights": [
            {
                "bullet": "Built resilient internal platform services.",
                "tags": [],
                "metrics": [],
            }
        ],
    }
    assert resume_json["experience"][2]["company"] == "Northwind Partners"
    assert resume_json["experience"][2]["role"] == "QA Automation Lead"
    assert resume_json["experience"][2]["location"] == "Chicago, IL"
    assert resume_json["experience"][2]["start"] == "2016"
    assert resume_json["experience"][2]["end"] == "2018"
    assert [item["bullet"] for item in resume_json["experience"][2]["highlights"]] == [
        "Reduced regression testing cycle time."
    ]


def test_generate_resume_collects_common_resume_date_formats_when_ai_fails(client, monkeypatch):
    token = _signup(client)
    fake_client = _FailingGeminiClient()
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: fake_client)

    resume_bytes = _docx_bytes(
        "\n".join([
            "Alex Resume",
            "Data Analyst",
            "alex@example.com",
            "EXPERIENCE",
            "05/2021 - 08/2023",
            "Data Analyst",
            "Insight LLC",
            "Built dashboards",
            "Project Manager | BuildCo | 2018 - 2020",
            "Delivered migration",
            "EDUCATION",
            "State University",
            "BS Computer Science",
            "May 2021",
        ])
    )
    response = client.post(
        "/agent/generate-resume",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mode": "MODE_A",
            "input": {
                "fileData": {
                    "mimeType": DOCX_MIME,
                    "name": "alex-resume.docx",
                    "data": base64.b64encode(resume_bytes).decode("ascii"),
                }
            },
        },
    )

    assert response.status_code == 200, response.text
    text = response.json()["text"]
    json_blob = text.split("RESUME_JSON:", 1)[1].split("GAP_AND_FIX_LIST:", 1)[0].strip()
    resume_json = json.loads(json_blob)

    assert resume_json["experience"][0]["role"] == "Data Analyst"
    assert resume_json["experience"][0]["company"] == "Insight LLC"
    assert resume_json["experience"][0]["start"] == "05/2021"
    assert resume_json["experience"][0]["end"] == "08/2023"

    assert resume_json["experience"][1]["role"] == "Project Manager"
    assert resume_json["experience"][1]["company"] == "BuildCo"
    assert resume_json["experience"][1]["start"] == "2018"
    assert resume_json["experience"][1]["end"] == "2020"

    assert resume_json["education"][0]["school"] == "State University"
    assert resume_json["education"][0]["degree"] == "BS Computer Science"
    assert resume_json["education"][0]["start"] == "May 2021"
    assert resume_json["education"][0]["end"] == ""
