from __future__ import annotations


def _signup(client, email: str = "cover-url@example.com") -> str:
    response = client.post(
        "/auth/signup",
        json={"name": "Cover User", "email": email, "password": "secret123", "plan": "free"},
    )
    assert response.status_code == 201, response.text
    return response.json()["token"]


def test_generate_cover_letter_from_job_url_fetches_description(client, monkeypatch):
    token = _signup(client)
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
    assert payload["content"]["resumeReference"] == "Platform Engineer (classic_pro)"
    assert payload["content"]["generationSource"] == "local_script"
    assert "Build internal developer platforms" in payload["content"]["coverLetterFull"]


def test_generate_cover_letter_prefers_job_title_over_resume_title(client, monkeypatch):
    token = _signup(client, "cover-title@example.com")
    monkeypatch.setattr(
        "app.api.routes.cover_letters._fetch_job_description_from_url",
        lambda url: (
            "Software Architect\nDesign AI-enabled platforms and lead architecture practices.",
            "Software Architect",
        ),
    )

    response = client.post(
        "/cover-letters/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "jobUrl": "https://jobs.example.com/software-architect",
            "title": "Senior Developer Cover Letter",
            "resumeJson": {
                "targetRole": "Senior Developer",
                "personalDetails": {"summary": "Senior developer with platform experience."},
            },
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()["coverLetter"]
    assert payload["title"] == "Software Architect"
    assert "Software Architect role" in payload["content"]["coverLetterFull"]
    assert "Senior Developer Cover Letter" not in payload["content"]["coverLetterFull"]


def test_generate_cover_letter_normalizes_noisy_job_board_title(client, monkeypatch):
    token = _signup(client, "cover-noisy-title@example.com")
    noisy_title = "Software Architect - AI Accelerated Engineering Lead (Central) - 617 - Slalom"
    monkeypatch.setattr(
        "app.api.routes.cover_letters._fetch_job_description_from_url",
        lambda url: (
            f"{noisy_title}\nMission\nDesign AI-enabled platforms and lead architecture practices.",
            noisy_title,
        ),
    )

    response = client.post(
        "/cover-letters/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "jobUrl": "https://jobs.slalom.com/en_US/careersmarketplace/JobDetail?jobId=617",
            "resumeJson": {"targetRole": "Senior Developer"},
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()["coverLetter"]
    assert payload["title"] == "Software Architect"
    assert noisy_title not in payload["content"]["coverLetterFull"]
    assert noisy_title not in payload["content"]["coverLetterShort"]
    assert noisy_title not in payload["content"]["coldEmail"]
    assert "Software Architect role" in payload["content"]["coverLetterFull"]


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
    content = response.json()["coverLetter"]["content"]
    generated_text = "\n".join(
        [
            content["coverLetterFull"],
            content["coverLetterShort"],
            content["coldEmail"],
        ]
    )
    assert "Software Architect" in generated_text
    assert "Led AI platform work." in generated_text
    assert "fileData" not in generated_text
    assert "profileImageData" not in generated_text
    assert binary_blob not in generated_text


def test_generate_cover_letter_uses_local_script(client, monkeypatch):
    token = _signup(client, "cover-fallback@example.com")
    monkeypatch.setattr(
        "app.api.routes.cover_letters._fetch_job_description_from_url",
        lambda url: (
            "Software Architect\nDesign AI-enabled platforms, mentor engineering teams, and build reliable delivery practices.",
            "Software Architect",
        ),
    )

    response = client.post(
        "/cover-letters/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "jobUrl": "https://jobs.example.com/software-architect",
            "resumeJson": {
                "targetRole": "Software Architect",
                "personalDetails": {
                    "summary": "Architect with platform engineering and AI delivery experience.",
                },
                "experienceItems": [
                    {
                        "role": "Lead Architect",
                        "company": "Example Co",
                        "description": "Built developer platforms and mentored engineering teams.",
                    }
                ],
            },
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()["coverLetter"]
    assert payload["title"] == "Software Architect"
    assert payload["content"]["generationSource"] == "local_script"
    assert "Dear Hiring Team" in payload["content"]["coverLetterFull"]
    assert "platform engineering and AI delivery experience" in payload["content"]["coverLetterFull"]


def test_download_cover_letter_pdf(client):
    token = _signup(client, "cover-pdf@example.com")

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
