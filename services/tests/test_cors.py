import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from app.core.config import MYRESUMES_FRONTEND_ORIGINS, Settings


def cors_client(config):
    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origins=config.allowed_origins,
                       allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

    @app.post('/auth/login')
    def login():
        return {"reached": True}

    return TestClient(app)


@pytest.mark.parametrize('origin', MYRESUMES_FRONTEND_ORIGINS)
def test_existing_frontend_aliases_can_preflight_login(origin):
    config = Settings(_env_file=None, cors_origins='https://myresumes.net,https://www.myresumes.net')
    with cors_client(config) as client:
        response = client.options('/auth/login', headers={
            'Origin': origin, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type,authorization',
        })
        assert response.status_code == 200, response.text
        assert response.headers['access-control-allow-origin'] == origin
        assert response.headers['access-control-allow-credentials'] == 'true'
        posted = client.post('/auth/login', headers={'Origin': origin}, json={})
        assert posted.status_code == 200
        assert posted.headers['access-control-allow-origin'] == origin


@pytest.mark.parametrize('origin', ['https://unrelated.onrender.com', 'https://myresume-rrcy.onrender.com.attacker.example'])
def test_alias_compatibility_does_not_allow_unrelated_origins(origin):
    config = Settings(_env_file=None, cors_origins='https://www.myresumes.net')
    with cors_client(config) as client:
        response = client.options('/auth/login', headers={'Origin': origin, 'Access-Control-Request-Method': 'POST'})
        assert response.status_code == 400
        assert 'access-control-allow-origin' not in response.headers


def test_custom_deployments_and_strict_allowlists_are_not_expanded():
    custom = Settings(_env_file=None, cors_origins='https://resumes.example.com')
    assert custom.allowed_origins == ['https://resumes.example.com']
    strict = Settings(_env_file=None, cors_origins='https://www.myresumes.net', include_legacy_frontend_aliases=False)
    assert strict.allowed_origins == ['https://www.myresumes.net']
    with cors_client(strict) as client:
        assert client.options('/auth/login', headers={
            'Origin': 'https://myresume-rrcy.onrender.com', 'Access-Control-Request-Method': 'POST',
        }).status_code == 400
