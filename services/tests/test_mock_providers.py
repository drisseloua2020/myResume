from sqlalchemy import func, select
from app.core.config import Settings, settings
from app.models.entities import JobApplication, ProviderOperation, User
import pytest


def signup(client, email='demo@example.com'):
    response = client.post('/auth/signup', json={'name': 'Demo User', 'email': email, 'password': 'demo-password-123'})
    assert response.status_code == 201, response.text
    data = response.json()
    return data['user']['id'], {'Authorization': f"Bearer {data['token']}"}


def execute(client, headers, provider, action, key='demo-idempotency-key-1234', **inputs):
    return client.post('/providers/demo/execute', headers=headers, json={
        'provider': provider, 'action': action, 'idempotencyKey': key, **inputs})


@pytest.fixture
def demo(monkeypatch):
    monkeypatch.setattr(settings, 'mock_providers_enabled', True)


def test_mock_providers_are_opt_in_and_rejected_in_production(client, monkeypatch):
    _, headers = signup(client)
    assert client.get('/providers/capabilities').json()['demoEnabled'] is False
    assert execute(client, headers, 'jobs', 'discover').status_code == 404
    config = Settings(_env_file=None, app_env='production', mock_providers_enabled=True)
    with pytest.raises(RuntimeError, match='Mock providers'):
        config.validate_runtime_settings()
    monkeypatch.setattr(settings, 'mock_providers_enabled', True)
    monkeypatch.setattr(settings, 'app_env', 'production')
    assert client.get('/providers/capabilities').json()['demoEnabled'] is False
    assert execute(client, headers, 'jobs', 'discover').status_code == 404


def test_billing_is_replay_safe_and_never_grants_paid_entitlements(client, db_session, demo):
    user_id, headers = signup(client)
    first = execute(client, headers, 'billing', 'checkout')
    assert first.status_code == 200, first.text
    repeat = execute(client, headers, 'billing', 'checkout')
    assert repeat.json()['replayed'] is True
    assert repeat.json()['operation']['id'] == first.json()['operation']['id']
    assert execute(client, headers, 'billing', 'checkout', plan='pro_yearly').status_code == 409
    failed = execute(client, headers, 'billing', 'cancel', key='failed-cancel-key-1234', scenario='failure').json()['operation']
    assert failed['status'] == 'failed'
    assert client.get('/providers/demo/state', headers=headers).json()['billing']['subscriptionStatus'] == 'active'
    assert execute(client, headers, 'billing', 'cancel', key='successful-cancel-1234').status_code == 200
    assert client.get('/providers/demo/state', headers=headers).json()['billing']['plan'] == 'free'
    db_session.expire_all()
    assert db_session.get(User, user_id).plan == 'free'
    assert db_session.get(User, user_id).paid_amount == 0


def test_profile_simulation_requires_connection_and_does_not_edit_resumes(client, demo):
    _, headers = signup(client)
    assert execute(client, headers, 'profile', 'sync', subjectId='github').status_code == 409
    assert execute(client, headers, 'profile', 'connect', key='connect-demo-key-1234', subjectId='github').status_code == 200
    synced = execute(client, headers, 'profile', 'sync', key='sync-demo-key-1234567', subjectId='github')
    assert synced.status_code == 200, synced.text
    assert synced.json()['operation']['result']['updates'][0]['externalId'] == 'mock-github-achievement-v1'
    assert client.get('/providers/demo/state', headers=headers).json()['profiles']['github'] is True
    assert execute(client, headers, 'profile', 'disconnect', key='disconnect-demo-12345', subjectId='github').status_code == 200
    assert client.get('/providers/demo/state', headers=headers).json()['profiles']['github'] is False
    assert execute(client, headers, 'profile', 'sync', key='sync-after-disconnect', subjectId='github').status_code == 409
    assert client.get('/resumes', headers=headers).json()['resumes'] == []


def test_sample_jobs_are_labeled_and_save_without_duplicates(client, db_session, demo):
    _, headers = signup(client)
    jobs = execute(client, headers, 'jobs', 'discover').json()['operation']['result']['jobs']
    assert len(jobs) == 3 and all(job['title'].startswith('[Demo]') for job in jobs)
    first = execute(client, headers, 'jobs', 'save', subjectId=jobs[0]['id'], key='save-sample-job-key-1')
    repeat = execute(client, headers, 'jobs', 'save', subjectId=jobs[0]['id'], key='save-sample-job-key-2')
    assert first.status_code == repeat.status_code == 200
    assert repeat.json()['replayed'] is True
    assert first.json()['operation']['result']['jobId'] == repeat.json()['operation']['result']['jobId']
    assert db_session.scalar(select(func.count()).select_from(JobApplication)) == 1


def test_simulated_submission_requires_owned_current_approval_and_deduplicates(client, db_session, demo):
    _, headers = signup(client)
    resume_id = client.post('/resumes', headers=headers, json={'templateId': 'classic_pro', 'title': 'Demo resume', 'content': {'targetRole': 'Engineer'}}).json()['id']
    job_id = client.post('/career/jobs', headers=headers, json={'title': 'Sample job', 'jobDescription': 'Build reliable software and support engineering teams.', 'resumeId': resume_id}).json()['job']['id']
    assert execute(client, headers, 'applications', 'submit', subjectId=job_id).status_code == 409
    _, other = signup(client, 'other-demo@example.com')
    assert execute(client, other, 'applications', 'submit', subjectId=job_id).status_code == 404
    packet = client.post(f'/career/jobs/{job_id}/prepare', headers=headers).json()['job']['packet']
    client.post(f'/career/jobs/{job_id}/decision', headers=headers, json={'packetId': packet['id'], 'decision': 'approved'})
    first = execute(client, headers, 'applications', 'submit', subjectId=job_id)
    assert first.status_code == 200, first.text
    assert first.json()['operation']['result']['submittedExternally'] is False
    repeat = execute(client, headers, 'applications', 'submit', subjectId=job_id, key='second-submit-key-123')
    assert repeat.json()['operation']['id'] == first.json()['operation']['id']
    db_session.expire_all()
    assert db_session.get(JobApplication, job_id).status == 'saved'
    assert db_session.get(JobApplication, job_id).packet['submitted'] is False
    client.put(f'/resumes/{resume_id}', headers=headers, json={'content': {'targetRole': 'Changed'}})
    assert execute(client, headers, 'applications', 'submit', subjectId=job_id, key='stale-submit-key-1234').status_code == 409


def test_demo_email_and_timeout_never_contact_external_services(client, monkeypatch, demo):
    def forbidden(*args, **kwargs):
        raise AssertionError('Mock operation attempted a network call')
    monkeypatch.setattr('smtplib.SMTP', forbidden)
    monkeypatch.setattr('smtplib.SMTP_SSL', forbidden)
    monkeypatch.setattr('socket.create_connection', forbidden)
    _, headers = signup(client)
    mail = execute(client, headers, 'email', 'send').json()['operation']['result']
    assert mail['recipient'].endswith('.invalid') and mail['deliveredExternally'] is False
    timeout = execute(client, headers, 'email', 'send', key='timeout-email-key-1234', scenario='timeout').json()['operation']
    assert timeout['status'] == 'failed' and timeout['result']['retryable'] is True


def test_demo_history_is_owned_exportable_and_deleted_with_account(client, db_session, demo):
    user_id, headers = signup(client)
    assert client.get('/providers/demo/operations').status_code == 401
    execute(client, headers, 'email', 'send')
    _, other = signup(client, 'other-demo@example.com')
    assert client.get('/providers/demo/operations', headers=other).json()['total'] == 0
    export = client.get('/auth/me/data', headers=headers).json()
    assert len(export['records']['provider_operations']) == 1
    response = client.post('/auth/me/delete', headers=headers, json={'confirmationEmail': 'demo@example.com', 'currentPassword': 'demo-password-123'})
    assert response.status_code == 200, response.text
    assert db_session.scalar(select(func.count()).select_from(ProviderOperation).where(ProviderOperation.user_id == user_id)) == 0
