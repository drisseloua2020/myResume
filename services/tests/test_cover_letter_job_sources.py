from __future__ import annotations


class _FakeGeminiResponse:
    text = """COVER_LETTER_FULL:
Dear hiring team,

I am excited to apply for the Platform Engineer role.

COVER_LETTER_SHORT:
I am excited to apply.

COLD_EMAIL:
Hello, I would like to connect about this role."""


class _FakeGeminiModels:
    def __init__(self):
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return _FakeGeminiResponse()


class _FakeGeminiClient:
    def __init__(self):
        self.models = _FakeGeminiModels()


def _signup(client, email: str = "cover-url@example.com") -> str:
    response = client.post(
        "/auth/signup",
        json={"name": "Cover User", "email": email, "password": "secret123", "plan": "free"},
    )
    assert response.status_code == 201, response.text
    return response.json()["token"]


def test_generate_cover_letter_from_job_url_fetches_description(client, monkeypatch):
    token = _signup(client)
    fake_client = _FakeGeminiClient()
    monkeypatch.setattr("app.api.routes.cover_letters.get_gemini_client", lambda: fake_client)
    monkeypatch.setattr(
        "app.api.routes.cover_letters._fetch_job_description_from_url",
        lambda url: ("Platform Engineer\nBuild internal developer platforms and APIs.", "Platform Engineer"),
    )

    response = client.post(
        "/cover-letters/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "jobUrl": "https://jobs.example.com/platform-engineer",
            "templateId": "classic_pro",
            "resumeJson": {"targetRole": "Platform Engineer"},
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()["coverLetter"]
    assert payload["title"] == "Platform Engineer"
    assert payload["jobUrl"] == "https://jobs.example.com/platform-engineer"
    assert "Build internal developer platforms" in payload["jobDescription"]

    contents = fake_client.models.calls[0]["contents"][0]
    assert "https://jobs.example.com/platform-engineer" in contents
    assert "Build internal developer platforms" in contents


def test_generate_cover_letter_returns_error_when_job_url_cannot_be_processed(client, monkeypatch):
    token = _signup(client, "cover-url-error@example.com")

    def fail_fetch(url: str):
        raise ValueError("Could not process the job URL. Paste the job description instead.")

    monkeypatch.setattr("app.api.routes.cover_letters._fetch_job_description_from_url", fail_fetch)

    response = client.post(
        "/cover-letters/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={"jobUrl": "https://jobs.example.com/missing"},
    )

    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Could not process the job URL. Paste the job description instead."


def test_generate_cover_letter_strips_uploaded_binary_resume_context(client, monkeypatch):
    token = _signup(client, "cover-sanitize@example.com")
    fake_client = _FakeGeminiClient()
    monkeypatch.setattr("app.api.routes.cover_letters.get_gemini_client", lambda: fake_client)
    monkeypatch.setattr(
        "app.api.routes.cover_letters._fetch_job_description_from_url",
        lambda url: (
            "Software Architect\nBuild AI-accelerated engineering platforms and mentor teams.",
            "Software Architect",
        ),
    )
    binary_blob = "a" * 50000

    response = client.post(
        "/cover-letters/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "jobUrl": "https://jobs.example.com/software-architect",
            "resumeJson": {
                "targetRole": "Software Architect",
                "currentResumeText": "Experienced architect with AI delivery background.",
                "fileData": {"mimeType": "application/pdf", "data": binary_blob},
                "profileImageData": {"mimeType": "image/png", "data": binary_blob},
                "experienceItems": [
                    {
                        "role": "Architect",
                        "company": "Example Co",
                        "description": "Led AI platform work.",
                    }
                ],
            },
        },
    )

    assert response.status_code == 201, response.text
    contents = fake_client.models.calls[0]["contents"][0]
    assert "Software Architect" in contents
    assert "Experienced architect with AI delivery background." in contents
    assert "Led AI platform work." in contents
    assert "fileData" not in contents
    assert "profileImageData" not in contents
    assert binary_blob not in contents


def test_download_cover_letter_pdf(client, monkeypatch):
    token = _signup(client, "cover-pdf@example.com")
    fake_client = _FakeGeminiClient()
    monkeypatch.setattr("app.api.routes.cover_letters.get_gemini_client", lambda: fake_client)

    created = client.post(
        "/cover-letters/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Platform Engineer",
            "jobDescription": "Platform Engineer role building APIs, automation, and reliable developer workflows.",
        },
    )
    assert created.status_code == 201, created.text
    cover_letter_id = created.json()["coverLetter"]["id"]

    response = client.get(f"/cover-letters/{cover_letter_id}/pdf", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-1.4")
