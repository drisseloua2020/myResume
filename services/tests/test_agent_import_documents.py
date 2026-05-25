from __future__ import annotations

import base64
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
    contents = fake_client.models.calls[0]["contents"]
    joined = "\n".join(part for part in contents if isinstance(part, str))
    assert "EXTRACTED_RESUME_TEXT_FROM_WORD_DOCUMENT" in joined
    assert "Alex Resume" in joined
    assert "Senior Python Engineer" in joined


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
