from __future__ import annotations

from typing import Any

from app.core.config import Settings, settings

AI_USAGE_RULE = (
    "MyResumes runs deterministic local workflows with no LLM calls by default. "
    "An AI gateway may be used only when AI_GATEWAY_ENABLED=true and gateway "
    "configuration is present."
)


def ai_usage_policy(config: Settings = settings) -> dict[str, Any]:
    gateway_enabled = bool(config.ai_gateway_enabled)
    gateway_provider = config.ai_gateway_provider.strip() or None
    gateway_configured = bool(config.ai_gateway_url.strip())

    return {
        "rule": AI_USAGE_RULE,
        "defaultMode": "deterministic",
        "currentMode": "ai_gateway" if gateway_enabled else "deterministic",
        "noLlmByDefault": True,
        "llmCallsAllowed": gateway_enabled,
        "gateway": {
            "enabled": gateway_enabled,
            "configured": gateway_enabled and gateway_configured,
            "provider": gateway_provider if gateway_enabled else None,
        },
    }


def require_ai_gateway_enabled(config: Settings = settings) -> None:
    if not config.ai_gateway_enabled:
        raise RuntimeError(
            "AI gateway is disabled. Set AI_GATEWAY_ENABLED=true and configure "
            "AI_GATEWAY_URL before calling gateway-backed features."
        )
