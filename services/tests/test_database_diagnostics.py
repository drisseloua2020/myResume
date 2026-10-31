import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from app.api.deps import get_db
from app.core.config import DATABASE_SCHEMA_REVISION, settings
from app.db.diagnostics import database_report
from app.main import app
from app.models.entities import User
from app.core.security import hash_password


def test_read_only_diagnostics_identify_missing_auth_column_without_exposing_credentials():
    engine = create_engine('sqlite+pysqlite:///:memory:')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE users (id TEXT, password_hash TEXT, status TEXT)'))
        connection.execute(text('INSERT INTO users VALUES (:id, :password, :status)'),
                           {'id': 'private-account-id', 'password': 'private-legacy-value', 'status': 'Active'})
    report = database_report(engine, auth_summary=True)
    assert report['connection'] == 'ok'
    assert report['ready'] is False
    assert report['migrationMetadataPresent'] is False
    assert 'token_version' in report['missingUserColumns']
    assert report['passwordFormats']['other'] == 1
    assert 'private-legacy-value' not in json.dumps(report)
    assert 'private-account-id' not in json.dumps(report)
    with engine.connect() as connection:
        assert connection.execute(text('SELECT password_hash FROM users')).scalar() == 'private-legacy-value'
    engine.dispose()


def test_diagnostics_recognize_current_user_schema_and_revision():
    engine = create_engine('sqlite+pysqlite:///:memory:')
    User.__table__.create(engine)
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE alembic_version (version_num VARCHAR(32))'))
        connection.execute(text('INSERT INTO alembic_version VALUES (:revision)'), {'revision': DATABASE_SCHEMA_REVISION})
    report = database_report(engine)
    assert report['ready'] is True
    assert report['missingUserColumns'] == []
    assert 'passwordFormats' not in report
    engine.dispose()


def test_diagnostics_do_not_create_a_missing_sqlite_database(tmp_path):
    target = tmp_path / 'missing.db'
    engine = create_engine(f'sqlite+pysqlite:///{target.as_posix()}')
    assert database_report(engine)['error'] == 'database_file_missing'
    assert not target.exists()
    engine.dispose()


def test_preexisting_account_with_short_argon2_password_still_logs_in(client, db_session):
    original_hash = hash_password('old123')
    db_session.add(User(id='preexisting-user', name='Existing User', email='existing@example.com',
                        password_hash=original_hash, role='user', plan='free', status='Active'))
    db_session.commit()
    result = client.post('/auth/login', json={'email': 'EXISTING@example.com', 'password': 'old123'})
    assert result.status_code == 200, result.text
    assert result.json()['user']['id'] == 'preexisting-user'
    token = result.json()['token']
    assert client.get('/auth/me', headers={'Authorization': f'Bearer {token}'}).status_code == 200
    db_session.expire_all()
    assert db_session.get(User, 'preexisting-user').password_hash == original_hash


@pytest.mark.parametrize('schema_failure', [False, True])
def test_database_login_failures_are_sanitized_and_keep_cors_headers(client, caplog, schema_failure):
    class DriverError(Exception):
        sqlstate = '42703' if schema_failure else '08006'
    def unavailable_database():
        error_type = ProgrammingError if schema_failure else OperationalError
        raise error_type('private SQL', {'password': 'do-not-log-this'}, DriverError('private connection details'))
    app.dependency_overrides[get_db] = unavailable_database
    try:
        origin = settings.allowed_origins[0]
        result = client.post('/auth/login', headers={'Origin': origin}, json={'email': 'test@example.com', 'password': 'test-password'})
        assert result.status_code == 503
        assert result.headers['access-control-allow-origin'] == origin
        assert result.headers['x-request-id'] in caplog.text
        assert 'do-not-log-this' not in caplog.text + result.text
        assert 'private connection details' not in caplog.text + result.text
        assert 'private SQL' not in caplog.text + result.text
        if schema_failure:
            assert 'migrations' in result.json()['detail']
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.parametrize('allowed', [True, False])
def test_unhandled_login_errors_keep_cors_policy(allowed):
    def unexpected_failure():
        raise RuntimeError('private internal failure')
    app.dependency_overrides[get_db] = unexpected_failure
    try:
        origin = settings.allowed_origins[0] if allowed else 'https://unrelated.onrender.com'
        with TestClient(app, raise_server_exceptions=False) as client:
            result = client.post('/auth/login', headers={'Origin': origin}, json={'email': 'test@example.com', 'password': 'test-password'})
        assert result.status_code == 500
        assert 'private internal failure' not in result.text
        if allowed:
            assert result.headers['access-control-allow-origin'] == origin
        else:
            assert 'access-control-allow-origin' not in result.headers
    finally:
        app.dependency_overrides.pop(get_db, None)
