import base64
from io import BytesIO
from zipfile import ZipFile, ZIP_DEFLATED
import jwt
import pytest
from sqlalchemy import select
from pypdf import PdfReader
from app.core.config import Settings, settings
from app.core.security import verify_password
from app.models.entities import User, Resume, CoverLetter
from app.services.resume_parser.framework import _extract_docx_text, ResumeParseError
from app.services.safe_fetch import fetch_public_text


def account(client, email="owner@example.com"):
    result = client.post('/auth/signup', json={"name": "Owner", "email": email, "password": "secure-password-123"})
    assert result.status_code == 201, result.text
    return result.json(), {"Authorization": f"Bearer {result.json()['token']}"}


def resume(client, headers, title="Source"):
    result = client.post('/resumes', headers=headers, json={"templateId": "classic_pro", "title": title,
        "content": {"personalDetails": {"firstName": "Ren\u00e9e", "lastName": "\u738b", "email": "owner@example.com"}, "targetRole": "Engineer"}})
    assert result.status_code == 201, result.text
    return result.json()['id']


def test_production_rejects_unsafe_defaults():
    with pytest.raises(RuntimeError):
        Settings(_env_file=None, app_env="production", jwt_secret="change-me").validate_runtime_settings()
    config = Settings(_env_file=None, app_env="production", jwt_secret="x" * 48,
        database_url="postgresql+psycopg://runtime@db/resumes", cors_origins="https://resumes.example.com",
        oauth_frontend_url="https://resumes.example.com", oauth_cookie_secure=True)
    config.validate_runtime_settings()
    assert config.allowed_origins == ["https://resumes.example.com"]


def test_plaintext_password_and_missing_jwt_exp_are_rejected(client):
    assert verify_password("secret123", "secret123") == (False, False)
    token = jwt.encode({"userId": "anything"}, settings.jwt_secret, algorithm="HS256")
    assert client.get('/auth/me', headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_logout_revokes_token_and_deactivated_user_cannot_login(client, db_session):
    data, headers = account(client)
    assert client.post('/auth/logout', headers=headers).status_code == 200
    assert client.get('/auth/me', headers=headers).status_code == 401
    assert client.post('/auth/activity', headers=headers, json={"action": "REPLAY"}).status_code == 401
    user = db_session.get(User, data['user']['id']); user.status = 'Canceled'; db_session.commit()
    assert client.post('/auth/login', json={"email": user.email, "password": "secure-password-123"}).status_code == 401


def test_password_change_revokes_all_sessions(client):
    _, headers = account(client)
    response = client.post('/auth/me/password', headers=headers, json={"currentPassword": "secure-password-123", "newPassword": "new-secure-password"})
    assert response.status_code == 200
    assert client.get('/auth/me', headers=headers).status_code == 401
    assert client.post('/auth/login', json={"email": "owner@example.com", "password": "new-secure-password"}).status_code == 200


def test_password_reset_is_single_use_and_email_is_not_exposed(client, monkeypatch):
    _, headers = account(client)
    messages = []
    monkeypatch.setattr(settings, 'smtp_host', 'smtp.example.com')
    monkeypatch.setattr(settings, 'smtp_port', 587)
    monkeypatch.setattr('app.api.routes.auth.send_support_email', lambda **mail: messages.append(mail))
    assert client.post('/auth/forgot-password', json={"email": "owner@example.com"}).json() == {"ok": True}
    token = messages[0]['text'].split('resetToken=')[1].split()[0]
    payload = {"token": token, "newPassword": "reset-password-123"}
    assert client.post('/auth/reset-password', json=payload).status_code == 200
    assert client.post('/auth/reset-password', json=payload).status_code == 400
    assert client.get('/auth/me', headers=headers).status_code == 401


def test_linked_records_cannot_reference_another_user(client, db_session):
    _, first = account(client)
    foreign_resume = resume(client, first)
    user = db_session.scalar(select(User).where(User.email == 'owner@example.com'))
    letter = CoverLetter(id="foreign-letter", user_id=user.id, title="Private", job_description="Private", content={})
    db_session.add(letter); db_session.commit()
    _, second = account(client, 'second@example.com')
    for endpoint, payload in [('/career/jobs', {"title": "Role", "resumeId": foreign_resume}),
                              ('/career/jobs', {"title": "Role", "coverLetterId": letter.id}),
                              ('/career/achievements', {"title": "Proof", "content": "Private", "sourceResumeId": foreign_resume}),
                              ('/career/resume-versions', {"title": "Version", "resumeId": foreign_resume, "content": {}}),
                              ('/resumes/draft', {"resumeId": foreign_resume, "content": {}})]:
        assert client.post(endpoint, headers=second, json=payload).status_code == 404


def test_drafts_are_isolated_by_resume(client):
    _, headers = account(client)
    first, second = resume(client, headers), resume(client, headers)
    for record_id, value in ((first, "First edits"), (second, "Second edits")):
        assert client.post('/resumes/draft', headers=headers, json={"resumeId": record_id, "templateId": "classic_pro", "content": {"targetRole": value}}).status_code == 200
    result = client.get(f'/resumes/latest-draft?resumeId={first}', headers=headers).json()['draft']
    assert result['content']['targetRole'] == 'First edits'
    assert result['resumeId'] == first


def test_resume_import_retry_is_idempotent_and_does_not_consume_quota(client, monkeypatch):
    _, headers = account(client)
    monkeypatch.setattr(settings, 'free_resumes_per_day', 1)
    payload = {"templateId": "classic_pro", "title": "Imported", "content": {},
               "idempotencyKey": "import-attempt-1234567890"}
    first = client.post('/resumes', headers=headers, json=payload)
    retry = client.post('/resumes', headers=headers, json=payload)
    assert first.status_code == retry.status_code == 201
    assert first.json()['id'] == retry.json()['id']
    assert len(client.get('/resumes', headers=headers).json()['resumes']) == 1
    assert client.post('/resumes', headers=headers, json={**payload, "idempotencyKey": "different-attempt-123456"}).status_code == 429
    _, other = account(client, 'other-importer@example.com')
    separate = client.post('/resumes', headers=other, json=payload)
    assert separate.status_code == 201
    assert separate.json()['id'] != first.json()['id']


def test_packet_decisions_are_persistent_and_stale_approval_is_blocked(client):
    _, headers = account(client)
    source = resume(client, headers)
    job = client.post('/career/jobs', headers=headers, json={"title": "Engineer", "jobDescription": "Build reliable software for our customers", "resumeId": source}).json()['job']
    packet = client.post(f"/career/jobs/{job['id']}/prepare", headers=headers).json()['job']['packet']
    assert packet['decision'] == 'pending'
    client.put(f'/resumes/{source}', headers=headers, json={"content": {"targetRole": "Changed"}})
    assert client.post(f"/career/jobs/{job['id']}/decision", headers=headers, json={"packetId": packet['id'], "decision": "approved"}).status_code == 409
    packet = client.post(f"/career/jobs/{job['id']}/prepare", headers=headers).json()['job']['packet']
    response = client.post(f"/career/jobs/{job['id']}/decision", headers=headers, json={"packetId": packet['id'], "decision": "approved"})
    assert response.json()['job']['packet']['decision'] == 'approved'
    assert response.json()['job']['packet']['submitted'] is False
    assert client.post(f"/career/jobs/{job['id']}/decision", headers=headers, json={"packetId": packet['id'], "decision": "rejected"}).status_code == 409
    assert client.patch(f"/career/jobs/{job['id']}", headers=headers, json={"notes": "Edited"}).json()['job']['packet'] is None


def test_text_pdf_preserves_unicode_and_paginates(client):
    _, headers = account(client)
    description = '\n'.join(f'Item {i} ' + 'Long reliable achievement text ' * 15 for i in range(45))
    response = client.post('/career/exports/resume', headers=headers, json={"resumeJson": {
        "personalDetails": {"firstName": "Ren\u00e9e", "lastName": "\u738b"},
        "experienceItems": [{"role": "Engineer", "description": description}]}})
    assert response.status_code == 200, response.text
    data = base64.b64decode(response.json()['exports']['pdfBase64'])
    reader = PdfReader(BytesIO(data))
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert 'Ren\u00e9e' in text and '\u738b' in text and 'Item 44' in text
    assert len(reader.pages) > 1
    for page in reader.pages:
        assert not list(page.images)
        positions = []
        page.extract_text(visitor_text=lambda text, cm, tm, font, size: positions.append(tm[4] * cm[1] + tm[5] * cm[3] + cm[5]) if text.strip() else None)
        assert all(35 <= y <= 810 for y in positions)


def test_profile_connectors_do_not_fabricate_updates(client):
    _, headers = account(client)
    assert client.post('/agent/check', headers=headers).json()['updates'] == []
    assert all(not source['isConnected'] for source in client.get('/profile/sources', headers=headers).json()['sources'])
    assert client.post('/profile/sources/github/connect', headers=headers).status_code == 501
    assert client.post('/profile/sync', headers=headers, json={}).status_code == 501


def test_text_and_docx_exports_do_not_require_pdf_font_support(client, monkeypatch):
    from fastapi import HTTPException
    def unsupported_pdf(*args, **kwargs):
        raise HTTPException(422, 'Unsupported PDF character')
    monkeypatch.setattr('app.services.pdf_export.text_pdf', unsupported_pdf)
    _, headers = account(client)
    payload = {"resumeJson": {"targetRole": "Engineer"}}
    for format in ('txt', 'docx'):
        result = client.post('/career/exports/resume', headers=headers, json={**payload, "format": format})
        assert result.status_code == 200, result.text
        assert result.json()['exports'][f'{format}Base64']
    assert client.post('/career/exports/resume', headers=headers, json={**payload, "format": "pdf"}).status_code == 422


def test_version_requires_a_saved_resume_and_daily_quota_is_enforced(client, monkeypatch):
    _, headers = account(client)
    assert client.post('/career/resume-versions', headers=headers, json={"title": "Orphan", "content": {}}).status_code == 422
    monkeypatch.setattr(settings, 'free_resumes_per_day', 1)
    source = resume(client, headers)
    assert client.delete(f'/resumes/{source}', headers=headers).status_code == 200
    assert client.post('/resumes', headers=headers, json={"templateId": "classic_pro", "title": "Over quota", "content": {}}).status_code == 429


def test_auth_limits_and_request_headers_are_applied(client, monkeypatch):
    response = client.get('/health')
    assert response.headers['x-content-type-options'] == 'nosniff'
    assert response.headers['x-request-id']
    monkeypatch.setattr(settings, 'max_request_bytes', 10)
    assert client.post('/auth/login', json={"email": "example@example.com", "password": "test-password"}).status_code == 413
    monkeypatch.setattr(settings, 'max_request_bytes', 15000000)
    monkeypatch.setattr(settings, 'auth_requests_per_minute', 1)
    client.post('/auth/login', json={"email": "example@example.com", "password": "test-password"})
    assert client.post('/auth/login', json={"email": "example@example.com", "password": "test-password"}).status_code == 429


def test_photos_reject_spoofed_mime(client):
    _, headers = account(client)
    assert client.post('/uploads/profile-photo', headers=headers, files={'file': ('fake.png', b'not an image', 'image/png')}).status_code == 400


def test_docx_expansion_is_bounded():
    output = BytesIO()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('word/document.xml', 'A' * (6 * 1024 * 1024))
    with pytest.raises(ResumeParseError):
        _extract_docx_text(output.getvalue())


def test_private_dns_destinations_are_blocked(monkeypatch):
    monkeypatch.setattr('socket.getaddrinfo', lambda *args, **kwargs: [(2, 1, 6, '', ('127.0.0.1', 443))])
    with pytest.raises(ValueError, match='Private'):
        fetch_public_text('https://public-looking.example/job')


def test_public_shares_redact_contact_fields_and_can_be_revoked(client):
    _, headers = account(client)
    source = resume(client, headers)
    result = client.post('/career/shares', headers=headers, json={"resumeId": source, "isPublic": True, "redactPii": True})
    share = result.json()['share']
    public = client.get(f"/career/public/resumes/{share['slug']}")
    assert public.status_code == 200
    assert 'owner@example.com' not in public.text and 'Ren\u00e9e' not in public.text
    assert public.headers['x-robots-tag'] == 'noindex, nofollow'
    assert client.delete(f"/career/shares/{share['id']}", headers=headers).status_code == 200
    assert client.get(f"/career/public/resumes/{share['slug']}").status_code == 404


def test_private_redirect_and_oversized_job_sources_are_blocked(monkeypatch):
    class Response:
        status = 302
        def getheader(self, name, default=None):
            return {'Location': 'http://private.example/job', 'Content-Type': 'text/html'}.get(name, default)
        def read(self, length):
            return b'x' * length
    class Connection:
        opened = []
        def __init__(self, host, port, timeout):
            self.opened.append(host)
        def connect(self): pass
        def request(self, *args, **kwargs): pass
        def getresponse(self): return Response()
        def close(self): pass
    monkeypatch.setattr('http.client.HTTPConnection', Connection)
    monkeypatch.setattr('socket.getaddrinfo', lambda host, *args, **kwargs: [(2, 1, 6, '', ('127.0.0.1' if host == 'private.example' else '93.184.216.34', 80))])
    with pytest.raises(ValueError, match='Private'):
        fetch_public_text('http://public.example/job')
    assert Connection.opened == ['93.184.216.34']
    Response.status = 200
    with pytest.raises(ValueError, match='too large'):
        fetch_public_text('http://public.example/job', max_bytes=100)


def test_account_export_and_deletion_are_complete_and_isolated(client, db_session):
    first, headers = account(client)
    source = resume(client, headers)
    _, other = account(client, 'other@example.com')
    other_resume = resume(client, other)
    data = client.get('/auth/me/data', headers=headers).json()
    assert data['records']['resumes'][0]['id'] == source
    assert 'password_hash' not in str(data)
    response = client.post('/auth/me/delete', headers=headers, json={"confirmationEmail": "owner@example.com", "currentPassword": "secure-password-123"})
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert db_session.get(User, first['user']['id']) is None
    assert db_session.get(Resume, source) is None
    assert client.get(f'/resumes/{other_resume}', headers=other).status_code == 200


def test_admin_search_pagination_and_status_changes_are_authorized(client, db_session):
    admin, admin_headers = account(client, 'admin@example.com')
    owner, owner_headers = account(client, 'owner@example.com')
    assert client.get('/admin/users', headers=owner_headers).status_code == 403
    db_session.get(User, admin['user']['id']).role = 'admin'
    db_session.commit()
    result = client.get('/admin/users?q=owner@example.com&limit=1', headers=admin_headers)
    assert result.status_code == 200, result.text
    assert result.json()['total'] == 1
    assert result.json()['users'][0]['id'] == owner['user']['id']
    assert client.get('/admin/users?q=owner@example.com&offset=1&limit=1', headers=admin_headers).json()['users'] == []
    logs = client.get(f"/admin/activity-logs?userId={owner['user']['id']}&limit=1", headers=admin_headers).json()
    assert logs['total'] >= 1
    assert all(item['userId'] == owner['user']['id'] for item in logs['logs'])
    assert client.patch(f"/admin/users/{admin['user']['id']}/status", headers=admin_headers, json={"status": "Canceled"}).status_code == 409
    assert client.patch(f"/admin/users/{owner['user']['id']}/status", headers=admin_headers, json={"status": "Canceled"}).status_code == 200
    assert client.get('/auth/me', headers=owner_headers).status_code == 401
