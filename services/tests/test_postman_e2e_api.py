from __future__ import annotations

from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.enums import RoleEnum
from app.models.entities import User


TEMPLATE_ID = "modern_tech"
SOURCE_TO_CONNECT = "linkedin"


class _FakeGeminiResponse:
    text = """COVER_LETTER_FULL:
Dear Hiring Manager,

I am excited to apply for this role.

COVER_LETTER_SHORT:
I am excited to apply for this role.

COLD_EMAIL:
Could we schedule time to discuss the opportunity?"""


class _FakeGeminiModels:
    def generate_content(self, **_kwargs):
        return _FakeGeminiResponse()


class _FakeGeminiClient:
    models = _FakeGeminiModels()


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _signup(client, *, name: str, email: str, password: str = "Password123!") -> dict:
    response = client.post(
        "/auth/signup",
        json={"name": name, "email": email, "password": password, "plan": "free"},
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["token"]
    assert payload["user"]["email"] == email.lower()
    return payload


def _promote_to_admin(db_session: Session, user_id: str) -> None:
    admin = db_session.get(User, user_id)
    assert admin is not None
    admin.role = RoleEnum.admin.value
    db_session.commit()


def _install_external_service_fakes(monkeypatch) -> None:
    monkeypatch.setattr("app.api.routes.agent.get_gemini_client", lambda: _FakeGeminiClient())
    monkeypatch.setattr("app.api.routes.cover_letters.get_gemini_client", lambda: _FakeGeminiClient())
    monkeypatch.setattr("app.api.routes.admin.send_support_email", lambda **_kwargs: None)


def test_postman_collection_happy_path_e2e(client, db_session, monkeypatch):
    _install_external_service_fakes(monkeypatch)
    run_id = uuid4().hex[:12]
    user_email = f"postman.{run_id}@example.com"
    user_name = f"Postman User {run_id}"
    admin_email = f"admin.{run_id}@example.com"
    resume_title = f"Postman Resume {run_id}"
    cover_letter_title = f"Postman Cover Letter {run_id}"
    contact_subject = f"Postman Contact {run_id}"
    admin_source_name = f"Postman Source {run_id}"

    health = client.get("/health")
    assert health.status_code == 200, health.text
    assert health.json()["status"] == "ok"

    signup = _signup(client, name=user_name, email=user_email)
    user_token = signup["token"]
    user_id = signup["user"]["id"]
    user_headers = _auth_headers(user_token)

    login = client.post("/auth/login", json={"email": user_email, "password": "Password123!"})
    assert login.status_code == 200, login.text
    assert login.json()["user"]["email"] == user_email

    me = client.get("/auth/me", headers=user_headers)
    assert me.status_code == 200, me.text
    assert me.json()["user"]["id"] == user_id

    plan = client.patch("/auth/me/plan", headers=user_headers, json={"plan": "free"})
    assert plan.status_code == 200, plan.text
    assert plan.json()["user"]["plan"] == "free"

    provider = client.post("/auth/provider", json={"provider": "google", "plan": "free"})
    assert provider.status_code == 410, provider.text

    contact = client.post(
        "/auth/contact",
        json={
            "name": user_name,
            "email": user_email,
            "subject": contact_subject,
            "message": "Created by the Postman-style pytest E2E flow.",
        },
    )
    assert contact.status_code == 200, contact.text
    contact_message_id = contact.json()["id"]

    activity = client.post(
        "/auth/activity",
        headers=user_headers,
        json={"action": "POSTMAN_ACTIVITY_TEST", "details": "Pytest collection sanity check."},
    )
    assert activity.status_code == 200, activity.text
    assert activity.json()["ok"] is True

    uploaded_photo = client.post(
        "/uploads/profile-photo",
        headers=user_headers,
        files={"file": ("profile.png", b"\x89PNG\r\n\x1a\npytest-profile-photo", "image/png")},
    )
    assert uploaded_photo.status_code == 201, uploaded_photo.text
    uploaded_photo_json = uploaded_photo.json()
    assert uploaded_photo_json["url"].startswith("/uploads/profile-photo/")
    assert uploaded_photo_json["contentType"] == "image/png"

    public_photo = client.get(uploaded_photo_json["url"])
    assert public_photo.status_code == 401

    protected_photo = client.get(uploaded_photo_json["url"], headers=user_headers)
    assert protected_photo.status_code == 200, protected_photo.text
    assert protected_photo.content.startswith(b"\x89PNG")

    other_signup = _signup(client, name=f"Other User {run_id}", email=f"other.{run_id}@example.com")
    other_photo = client.get(uploaded_photo_json["url"], headers=_auth_headers(other_signup["token"]))
    assert other_photo.status_code == 404

    created_resume = client.post(
        "/resumes",
        headers=user_headers,
        json={
            "templateId": TEMPLATE_ID,
            "title": resume_title,
            "content": {
                "basics": {"name": user_name, "email": user_email},
                "profileImageUrl": uploaded_photo_json["url"],
                "summary": "Generated by the Postman-style pytest flow.",
            },
        },
    )
    assert created_resume.status_code == 201, created_resume.text
    resume_id = created_resume.json()["id"]

    resumes = client.get("/resumes", headers=user_headers)
    assert resumes.status_code == 200, resumes.text
    assert any(resume["id"] == resume_id for resume in resumes.json()["resumes"])

    draft = client.post(
        "/resumes/draft",
        headers=user_headers,
        json={"templateId": TEMPLATE_ID, "content": {"draft": True, "notes": "Autosave created by pytest."}},
    )
    assert draft.status_code == 200, draft.text
    assert draft.json()["ok"] is True

    latest_draft = client.get(f"/resumes/latest-draft?templateId={TEMPLATE_ID}", headers=user_headers)
    assert latest_draft.status_code == 200, latest_draft.text
    assert latest_draft.json()["draft"]["content"]["draft"] is True

    fetched_resume = client.get(f"/resumes/{resume_id}", headers=user_headers)
    assert fetched_resume.status_code == 200, fetched_resume.text
    assert fetched_resume.json()["resume"]["title"] == resume_title

    updated_resume = client.put(
        f"/resumes/{resume_id}",
        headers=user_headers,
        json={"title": f"{resume_title} Updated", "content": {"summary": "Updated by pytest."}},
    )
    assert updated_resume.status_code == 200, updated_resume.text
    assert updated_resume.json()["ok"] is True

    profile_sources = client.get("/profile/sources", headers=user_headers)
    assert profile_sources.status_code == 200, profile_sources.text
    assert profile_sources.json()["sources"]

    connected_source = client.post(f"/profile/sources/{SOURCE_TO_CONNECT}/connect", headers=user_headers)
    assert connected_source.status_code == 200, connected_source.text
    assert any(
        source["name"].lower() == SOURCE_TO_CONNECT and source["isConnected"]
        for source in connected_source.json()["sources"]
    )

    profile_sync = client.post("/profile/sync", headers=user_headers, json={"providers": [SOURCE_TO_CONNECT]})
    assert profile_sync.status_code == 200, profile_sync.text
    assert profile_sync.json()["updates"]

    profile_updates = client.get("/profile/updates", headers=user_headers)
    assert profile_updates.status_code == 200, profile_updates.text
    assert profile_updates.json()["updates"]

    agent_sources = client.get("/agent/sources", headers=user_headers)
    assert agent_sources.status_code == 200, agent_sources.text
    agent_source_id = agent_sources.json()["sources"][0]["id"]

    toggled_source = client.post(f"/agent/sources/{agent_source_id}/toggle", headers=user_headers)
    assert toggled_source.status_code == 200, toggled_source.text
    assert toggled_source.json()["source"]["id"] == agent_source_id

    agent_check = client.post("/agent/check", headers=user_headers)
    assert agent_check.status_code == 200, agent_check.text
    assert agent_check.json()["updates"]

    agent_updates = client.get("/agent/updates", headers=user_headers)
    assert agent_updates.status_code == 200, agent_updates.text
    assert agent_updates.json()["updates"]

    generated_resume = client.post(
        "/agent/generate-resume",
        headers=user_headers,
        json={
            "mode": "MODE_B",
            "input": {"targetRole": "Software Engineer", "personalDetails": {"firstName": "Postman"}},
        },
    )
    assert generated_resume.status_code == 200, generated_resume.text
    assert "COVER_LETTER_FULL" in generated_resume.json()["text"]

    generated_cover_letter = client.post(
        "/cover-letters/generate",
        headers=user_headers,
        json={
            "templateId": TEMPLATE_ID,
            "title": cover_letter_title,
            "jobDescription": "We need an engineer who can build reliable API services and tests.",
            "resumeJson": {"summary": "API engineer"},
        },
    )
    assert generated_cover_letter.status_code == 201, generated_cover_letter.text
    cover_letter_id = generated_cover_letter.json()["coverLetter"]["id"]

    cover_letters = client.get("/cover-letters", headers=user_headers)
    assert cover_letters.status_code == 200, cover_letters.text
    assert any(letter["id"] == cover_letter_id for letter in cover_letters.json()["coverLetters"])

    fetched_cover_letter = client.get(f"/cover-letters/{cover_letter_id}", headers=user_headers)
    assert fetched_cover_letter.status_code == 200, fetched_cover_letter.text
    assert fetched_cover_letter.json()["coverLetter"]["title"] == cover_letter_title

    admin_signup = _signup(client, name="Postman Admin", email=admin_email)
    admin_token = admin_signup["token"]
    _promote_to_admin(db_session, admin_signup["user"]["id"])
    admin_headers = _auth_headers(admin_token)

    auth_users = client.get("/auth/users", headers=admin_headers)
    assert auth_users.status_code == 200, auth_users.text
    assert any(user["id"] == user_id for user in auth_users.json()["users"])

    auth_logs = client.get("/auth/logs", headers=admin_headers)
    assert auth_logs.status_code == 200, auth_logs.text
    assert auth_logs.json()["logs"]

    updated_user_plan = client.patch(
        f"/auth/users/{user_id}/plan",
        headers=admin_headers,
        json={"plan": "free", "amount": "$0.00"},
    )
    assert updated_user_plan.status_code == 200, updated_user_plan.text
    assert updated_user_plan.json()["user"]["plan"] == "free"

    admin_users = client.get("/admin/users", headers=admin_headers)
    assert admin_users.status_code == 200, admin_users.text
    assert any(user["email"] == user_email for user in admin_users.json()["users"])

    admin_activity_logs = client.get("/admin/activity-logs", headers=admin_headers)
    assert admin_activity_logs.status_code == 200, admin_activity_logs.text
    assert admin_activity_logs.json()["logs"]

    templates = client.get("/admin/templates", headers=admin_headers)
    assert templates.status_code == 200, templates.text
    assert any(template["id"] == TEMPLATE_ID for template in templates.json()["templates"])

    admin_profile_sources = client.get("/admin/profile-sources", headers=admin_headers)
    assert admin_profile_sources.status_code == 200, admin_profile_sources.text

    created_profile_source = client.post(
        "/admin/profile-sources",
        headers=admin_headers,
        json={"name": admin_source_name, "icon": "link", "oauthProvider": "custom"},
    )
    assert created_profile_source.status_code == 201, created_profile_source.text
    source = next(
        item for item in created_profile_source.json()["sources"] if item["name"] == admin_source_name
    )

    toggled_profile_source = client.patch(
        f"/admin/profile-sources/{source['id']}/toggle",
        headers=admin_headers,
    )
    assert toggled_profile_source.status_code == 200, toggled_profile_source.text
    assert any(item["id"] == source["id"] for item in toggled_profile_source.json()["sources"])

    admin_contact_messages = client.get("/admin/contact-messages", headers=admin_headers)
    assert admin_contact_messages.status_code == 200, admin_contact_messages.text
    assert any(message["id"] == contact_message_id for message in admin_contact_messages.json()["messages"])

    replied = client.post(
        f"/admin/contact-messages/{contact_message_id}/reply",
        headers=admin_headers,
        json={"subject": "Reply from pytest", "message": "This is a mocked test reply."},
    )
    assert replied.status_code == 200, replied.text
    assert replied.json()["ok"] is True

    admin_resumes = client.get("/admin/resumes", headers=admin_headers)
    assert admin_resumes.status_code == 200, admin_resumes.text
    assert any(resume["id"] == resume_id for resume in admin_resumes.json()["resumes"])

    admin_agent_updates = client.get("/admin/agent-updates", headers=admin_headers)
    assert admin_agent_updates.status_code == 200, admin_agent_updates.text
    assert admin_agent_updates.json()["updates"]

    deleted_cover_letter = client.delete(f"/cover-letters/{cover_letter_id}", headers=user_headers)
    assert deleted_cover_letter.status_code == 200, deleted_cover_letter.text
    assert deleted_cover_letter.json()["ok"] is True

    deleted_resume = client.delete(f"/resumes/{resume_id}", headers=user_headers)
    assert deleted_resume.status_code == 200, deleted_resume.text
    assert deleted_resume.json()["ok"] is True

    logout = client.post("/auth/logout")
    assert logout.status_code == 200, logout.text
    assert logout.json()["ok"] is True
