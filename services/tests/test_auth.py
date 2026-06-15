from urllib.parse import parse_qs, urlparse

from sqlalchemy import select

from app.core.config import settings
from app.models.entities import OAuthAccount, User


def test_signup_login_and_me_flow(client):
    signup = client.post('/auth/signup', json={'name': 'Alice', 'email': 'alice@example.com', 'password': 'secret123', 'plan': 'free'})
    assert signup.status_code == 201, signup.text
    token = signup.json()['token']
    me = client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200, me.text
    assert me.json()['user']['email'] == 'alice@example.com'
    login = client.post('/auth/login', json={'email': 'alice@example.com', 'password': 'secret123'})
    assert login.status_code == 200, login.text
    assert login.json()['user']['name'] == 'Alice'


def test_mock_provider_endpoint_is_disabled(client):
    response = client.post('/auth/provider', json={'provider': 'google', 'plan': 'free'})
    assert response.status_code == 410


def test_oauth_start_redirect_sets_state_cookie(client, monkeypatch):
    monkeypatch.setattr(settings, 'google_oauth_client_id', 'google-client')
    monkeypatch.setattr(settings, 'google_oauth_client_secret', 'google-secret')

    response = client.get('/auth/oauth/google/start?templateId=classic_pro', follow_redirects=False)

    assert response.status_code == 302
    location = response.headers['location']
    parsed = urlparse(location)
    query = parse_qs(parsed.query)
    assert location.startswith('https://accounts.google.com/o/oauth2/v2/auth?')
    assert query['client_id'] == ['google-client']
    assert query['response_type'] == ['code']
    assert query['scope'] == ['openid profile email']
    assert query['redirect_uri'] == ['http://testserver/auth/oauth/google/callback']
    assert query['state'][0]
    assert 'rf_oauth_state_google=' in response.headers['set-cookie']


def test_oauth_callback_creates_user_and_allows_form_login_linking(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, 'google_oauth_client_id', 'google-client')
    monkeypatch.setattr(settings, 'google_oauth_client_secret', 'google-secret')
    monkeypatch.setattr(settings, 'oauth_frontend_url', 'http://localhost:4000')

    signup = client.post('/auth/signup', json={'name': 'Existing User', 'email': 'oauth@example.com', 'password': 'secret123', 'plan': 'free'})
    assert signup.status_code == 201, signup.text

    class DummyResponse:
        def __init__(self, payload):
            self.status_code = 200
            self._payload = payload

        def json(self):
            return self._payload

    class DummyAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, data, headers):
            assert url == 'https://oauth2.googleapis.com/token'
            assert data['client_id'] == 'google-client'
            assert data['client_secret'] == 'google-secret'
            assert data['code'] == 'provider-code'
            assert data['redirect_uri'] == 'http://testserver/auth/oauth/google/callback'
            assert data['grant_type'] == 'authorization_code'
            return DummyResponse({'access_token': 'provider-access-token', 'expires_in': 3600, 'scope': 'openid profile email'})

        async def get(self, url, headers):
            assert url == 'https://openidconnect.googleapis.com/v1/userinfo'
            assert headers['Authorization'] == 'Bearer provider-access-token'
            return DummyResponse({'sub': 'google-user-123', 'email': 'oauth@example.com', 'name': 'OAuth User'})

    import app.services.oauth as oauth_service
    monkeypatch.setattr(oauth_service.httpx, 'AsyncClient', DummyAsyncClient)

    start = client.get('/auth/oauth/google/start?templateId=classic_pro', follow_redirects=False)
    state = parse_qs(urlparse(start.headers['location']).query)['state'][0]
    callback = client.get(f'/auth/oauth/google/callback?code=provider-code&state={state}', follow_redirects=False)

    assert callback.status_code == 302
    redirect = urlparse(callback.headers['location'])
    redirect_query = parse_qs(redirect.query)
    assert callback.headers['location'].startswith('http://localhost:4000/?')
    assert redirect_query['templateId'] == ['classic_pro']
    token = redirect_query['token'][0]

    me = client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200, me.text
    assert me.json()['user']['email'] == 'oauth@example.com'
    assert me.json()['user']['authProvider'] == 'google'

    password_login = client.post('/auth/login', json={'email': 'oauth@example.com', 'password': 'secret123'})
    assert password_login.status_code == 200, password_login.text

    linked_user = db_session.scalar(select(User).where(User.email == 'oauth@example.com'))
    assert linked_user is not None
    account = db_session.scalar(select(OAuthAccount).where(OAuthAccount.user_id == linked_user.id))
    assert account is not None
    assert account.provider == 'google'
    assert account.provider_user_id == 'google-user-123'
    assert account.access_token is None
    assert account.refresh_token is None


def test_oauth_callback_creates_new_user_with_selected_plan(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, 'google_oauth_client_id', 'google-client')
    monkeypatch.setattr(settings, 'google_oauth_client_secret', 'google-secret')
    monkeypatch.setattr(settings, 'oauth_frontend_url', 'http://localhost:4000')

    class DummyResponse:
        def __init__(self, payload):
            self.status_code = 200
            self._payload = payload

        def json(self):
            return self._payload

    class DummyAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, data, headers):
            assert data['code'] == 'new-user-code'
            return DummyResponse({'access_token': 'provider-access-token', 'expires_in': 3600, 'scope': 'openid profile email'})

        async def get(self, url, headers):
            return DummyResponse({'sub': 'google-new-123', 'email': 'new.oauth@example.com', 'email_verified': True, 'name': 'New OAuth User'})

    import app.services.oauth as oauth_service
    monkeypatch.setattr(oauth_service.httpx, 'AsyncClient', DummyAsyncClient)

    start = client.get('/auth/oauth/google/start?plan=yearly', follow_redirects=False)
    state = parse_qs(urlparse(start.headers['location']).query)['state'][0]
    callback = client.get(f'/auth/oauth/google/callback?code=new-user-code&state={state}', follow_redirects=False)

    assert callback.status_code == 302
    token = parse_qs(urlparse(callback.headers['location']).query)['token'][0]
    me = client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200, me.text
    assert me.json()['user']['email'] == 'new.oauth@example.com'
    assert me.json()['user']['plan'] == 'yearly'
    assert me.json()['user']['authProvider'] == 'google'

    linked_user = db_session.scalar(select(User).where(User.email == 'new.oauth@example.com'))
    assert linked_user is not None
    assert linked_user.plan == 'yearly'
    account = db_session.scalar(select(OAuthAccount).where(OAuthAccount.user_id == linked_user.id))
    assert account is not None
    assert account.access_token is None
    assert account.refresh_token is None
