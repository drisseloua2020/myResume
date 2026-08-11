from __future__ import annotations


def _signup(client, email: str = "career@example.com") -> str:
    response = client.post(
        "/auth/signup",
        json={"name": "Career User", "email": email, "password": "secret123", "plan": "free"},
    )
    assert response.status_code == 201, response.text
    return response.json()["token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _resume() -> dict:
    return {
        "targetRole": "Platform Engineer",
        "personalDetails": {
            "firstName": "Jordan",
            "lastName": "Lee",
            "email": "jordan@example.com",
            "phone": "555-0100",
            "links": "https://portfolio.example.com/jordan",
            "summary": "Platform engineer with cloud, API, automation, and reliability experience.",
            "address": "",
            "city": "Austin",
            "state": "TX",
            "country": "US",
            "postalCode": "",
        },
        "experienceItems": [
            {
                "id": "exp-1",
                "role": "Platform Engineer",
                "company": "Example Co",
                "dates": "2021 - Present",
                "description": "- Built API automation used by 120 engineers.\n- Reduced deployment failures by 35% across cloud platforms.",
            }
        ],
        "educationItems": [{"id": "edu-1", "degree": "BS Computer Science", "school": "State University", "dates": "2016 - 2020"}],
        "skillItems": [{"id": "skills-1", "category": "Tools", "items": "AWS, Amazon Web Services, Kubernetes, Python, Terraform"}],
    }


def _job_description() -> str:
    return """Platform Engineer
Company: Acme Systems
Location: Remote
Salary: $140,000 - $165,000
Responsibilities
- Build internal developer platforms and APIs for cloud teams.
- Design Kubernetes automation and improve reliability.
Requirements
- Experience with AWS, Terraform, Python, security, and stakeholder communication.
- Preferred AWS Certified background."""


def test_career_analyze_scores_resume_and_reports_keywords(client):
    token = _signup(client)
    response = client.post(
        "/career/analyze",
        headers=_headers(token),
        json={"resumeJson": _resume(), "jobDescription": _job_description(), "jobUrl": "https://jobs.example.com/platform"},
    )

    assert response.status_code == 200, response.text
    report = response.json()["report"]
    assert report["noLlmCalls"] is True
    assert report["job"]["title"] == "Platform Engineer"
    assert report["job"]["company"] == "Acme Systems"
    assert report["atsScore"] >= 50
    assert "AWS" in report["includedKeywords"]
    assert "AWS" in report["skillTaxonomy"]["normalized"]
    assert report["skillTaxonomy"]["duplicates"]
    assert any(item["section"] == "experience" for item in report["sectionMatches"])
    assert report["bulletQuality"]["averageScore"] > 0
    assert report["templates"]["followUpEmail"]


def test_career_exports_resume_formats_and_validates_pdf(client):
    token = _signup(client, "career-export@example.com")
    response = client.post(
        "/career/exports/resume",
        headers=_headers(token),
        json={"resumeJson": _resume(), "title": "Jordan Resume", "publicProfileUrl": "https://www.myresumes.net/r/jordan", "redactPii": True},
    )

    assert response.status_code == 200, response.text
    exports = response.json()["exports"]
    assert "txtBase64" in exports
    assert "docxBase64" in exports
    assert "pdfBase64" in exports
    assert exports["pdfValidation"]["selectableText"] is True
    assert "[REDACTED]" in exports["atsText"]


def test_job_tracker_analytics_achievements_versions_and_data_delete(client):
    token = _signup(client, "career-records@example.com")
    headers = _headers(token)

    created_resume = client.post(
        "/resumes",
        headers=headers,
        json={"templateId": "modern_tech", "title": "Base Resume", "content": _resume()},
    )
    assert created_resume.status_code == 201, created_resume.text
    resume_id = created_resume.json()["id"]

    job = client.post(
        "/career/jobs",
        headers=headers,
        json={"status": "applied", "jobDescription": _job_description(), "resumeId": resume_id, "notes": "Applied via company site."},
    )
    assert job.status_code == 201, job.text
    job_payload = job.json()["job"]
    assert job_payload["company"] == "Acme Systems"
    assert job_payload["packet"]["resumeId"] == resume_id

    updated = client.patch(f"/career/jobs/{job_payload['id']}", headers=headers, json={"status": "interview", "contactName": "Riley Recruiter"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["job"]["status"] == "interview"

    achievement = client.post(
        "/career/achievements",
        headers=headers,
        json={"title": "Deployment Reliability", "category": "Platform", "content": "Reduced deployment failures by 35%.", "tags": ["cloud"], "metrics": "35%"},
    )
    assert achievement.status_code == 201, achievement.text
    assert achievement.json()["achievements"][0]["metrics"] == "35%"

    version = client.post(
        "/career/resume-versions",
        headers=headers,
        json={"resumeId": resume_id, "jobApplicationId": job_payload["id"], "kind": "tailored", "title": "Tailored Platform Resume", "content": _resume(), "changeSummary": "Matched Acme role."},
    )
    assert version.status_code == 201, version.text
    version_id = version.json()["versions"][0]["id"]
    restored = client.post(f"/career/resume-versions/{version_id}/restore", headers=headers)
    assert restored.status_code == 200, restored.text

    share = client.post("/career/shares", headers=headers, json={"resumeId": resume_id, "isPublic": True, "redactPii": True})
    assert share.status_code == 201, share.text
    assert share.json()["share"]["slug"]

    analytics = client.get("/career/jobs/analytics", headers=headers)
    assert analytics.status_code == 200, analytics.text
    assert analytics.json()["analytics"]["byStatus"]["interview"] == 1

    exported = client.get("/career/data-export", headers=headers)
    assert exported.status_code == 200, exported.text
    assert exported.json()["privacy"]["noLlmCalls"] is True
    assert len(exported.json()["jobs"]) == 1

    deleted = client.delete("/career/data", headers=headers)
    assert deleted.status_code == 200, deleted.text
    assert client.get("/career/jobs", headers=headers).json()["jobs"] == []


def test_linkedin_import_and_feature_catalog_are_deterministic(client):
    token = _signup(client, "career-linkedin@example.com")
    imported = client.post(
        "/career/import/linkedin",
        headers=_headers(token),
        json={"profileText": "Taylor Smith\nCloud Security Architect\nSkills: AWS, Amazon Web Services, Kubernetes, Security+\nExperience\nBuilt cloud programs."},
    )
    assert imported.status_code == 200, imported.text
    assert imported.json()["resume"]["personalDetails"]["firstName"] == "Taylor"
    assert "AWS" in imported.json()["resume"]["skillItems"][0]["items"]

    features = client.get("/career/features", headers=_headers(token))
    assert features.status_code == 200, features.text
    assert all(item["llmCalls"] is False for item in features.json()["features"])
    assert any(item["name"] == "Job tracker Kanban" for item in features.json()["features"])
