from __future__ import annotations

import pytest

from app.core.ai_policy import ai_usage_policy, require_ai_gateway_enabled
from app.core.config import Settings


def _settings(**overrides) -> Settings:
    return Settings(
        _env_file=None,
        database_url="sqlite+pysqlite:///./test.db",
        jwt_secret="test-secret",
        **overrides,
    )


def test_ai_usage_policy_is_deterministic_by_default():
    policy = ai_usage_policy(_settings())

    assert policy["defaultMode"] == "deterministic"
    assert policy["currentMode"] == "deterministic"
    assert policy["noLlmByDefault"] is True
    assert policy["llmCallsAllowed"] is False
    assert policy["gateway"] == {
        "enabled": False,
        "configured": False,
        "provider": None,
    }


def test_gateway_config_or_key_alone_does_not_enable_ai():
    policy = ai_usage_policy(
        _settings(
            ai_gateway_provider="internal",
            ai_gateway_url="https://gateway.example.com",
            ai_gateway_api_key="configured-key",
        )
    )

    assert policy["currentMode"] == "deterministic"
    assert policy["llmCallsAllowed"] is False
    assert policy["gateway"]["enabled"] is False
    assert policy["gateway"]["configured"] is False
    assert policy["gateway"]["provider"] is None


def test_gateway_requires_explicit_enablement():
    settings = _settings(
        ai_gateway_enabled=True,
        ai_gateway_provider="internal",
        ai_gateway_url="https://gateway.example.com",
    )

    policy = ai_usage_policy(settings)

    assert policy["currentMode"] == "ai_gateway"
    assert policy["llmCallsAllowed"] is True
    assert policy["gateway"] == {
        "enabled": True,
        "configured": True,
        "provider": "internal",
    }
    require_ai_gateway_enabled(settings)


def test_runtime_rejects_enabled_gateway_without_url():
    settings = _settings(ai_gateway_enabled=True)

    with pytest.raises(RuntimeError, match="AI_GATEWAY_URL"):
        settings.validate_runtime_settings()


def test_gateway_guard_blocks_callers_when_disabled():
    with pytest.raises(RuntimeError, match="AI gateway is disabled"):
        require_ai_gateway_enabled(_settings())
