from __future__ import annotations

import base64
import json
from io import BytesIO
from zipfile import ZipFile


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


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
    assert "Alex Resume" in joined
    assert "Senior Python Engineer" in joined
    assert encoded_resume not in joined
    assert '"textExtracted": true' in joined
    assert '"name": "alex-resume.docx"' in joined


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
