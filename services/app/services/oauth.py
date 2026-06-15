from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode
import secrets

import httpx
import jwt
from fastapi import HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import PlanEnum, RoleEnum
from app.core.security import sign_token
from app.models.entities import OAuthAccount, User
from app.services.activity import log_activity, new_prefixed_id


@dataclass(frozen=True)
class OAuthProvider:
    key: str
    label: str
    authorization_url: str
    token_url: str
    userinfo_url: str
    scope: str
    client_id: str
    client_secret: str


OAUTH_STATE_PURPOSE = "oauth_login"


def _oauth_providers() -> dict[str, OAuthProvider]:
    microsoft_tenant = (settings.microsoft_oauth_tenant or "common").strip() or "common"
    return {
        "google": OAuthProvider(
            key="google",
            label="Google",
            authorization_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
            scope="openid profile email",
            client_id=settings.google_oauth_client_id,
            client_secret=settings.google_oauth_client_secret,
        ),
        "microsoft": OAuthProvider(
            key="microsoft",
            label="Microsoft",
            authorization_url=f"https://login.microsoftonline.com/{microsoft_tenant}/oauth2/v2.0/authorize",
            token_url=f"https://login.microsoftonline.com/{microsoft_tenant}/oauth2/v2.0/token",
            userinfo_url="https://graph.microsoft.com/oidc/userinfo",
            scope="openid profile email",
            client_id=settings.microsoft_oauth_client_id,
            client_secret=settings.microsoft_oauth_client_secret,
        ),
        "linkedin": OAuthProvider(
            key="linkedin",
            label="LinkedIn",
            authorization_url="https://www.linkedin.com/oauth/v2/authorization",
            token_url="https://www.linkedin.com/oauth/v2/accessToken",
            userinfo_url="https://api.linkedin.com/v2/userinfo",
            scope="openid profile email",
            client_id=settings.linkedin_oauth_client_id,
            client_secret=settings.linkedin_oauth_client_secret,
        ),
    }


def _provider_or_404(provider: str) -> OAuthProvider:
    normalized = provider.strip().lower()
    config = _oauth_providers().get(normalized)
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unsupported SSO provider")
    return config


def _require_configured(provider: OAuthProvider) -> None:
    if not provider.client_id or not provider.client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider.label} SSO is not configured",
        )


def _state_cookie_name(provider: str) -> str:
    return f"rf_oauth_state_{provider}"


def _callback_url(request: Request, provider: str) -> str:
    if settings.oauth_redirect_base_url.strip():
        base_url = settings.oauth_redirect_base_url.rstrip("/")
        return f"{base_url}/auth/oauth/{provider}/callback"
    return str(request.url_for("oauth_callback", provider=provider))


def _frontend_redirect(params: dict[str, str]) -> str:
    base_url = settings.oauth_frontend_url.rstrip("/") or "http://localhost:4000"
    return f"{base_url}/?{urlencode(params)}"


def _signed_state(provider: str, nonce: str, plan: PlanEnum, template_id: str | None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "purpose": OAUTH_STATE_PURPOSE,
        "provider": provider,
        "nonce": nonce,
        "plan": plan.value,
        "iat": now,
        "exp": now + timedelta(seconds=max(60, settings.oauth_state_ttl_seconds)),
    }
    if template_id:
        payload["templateId"] = template_id
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _decode_state(provider: str, state: str, cookie_nonce: str | None) -> dict[str, Any]:
    if not state or not cookie_nonce:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid SSO state")
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid SSO state") from exc
    if payload.get("purpose") != OAUTH_STATE_PURPOSE or payload.get("provider") != provider:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid SSO state")
    if not secrets.compare_digest(str(payload.get("nonce", "")), cookie_nonce):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid SSO state")
    return payload


def create_oauth_start_redirect(
    request: Request,
    *,
    provider: str,
    plan: PlanEnum,
    template_id: str | None,
) -> RedirectResponse:
    config = _provider_or_404(provider)
    _require_configured(config)

    nonce = secrets.token_urlsafe(32)
    state = _signed_state(config.key, nonce, plan, template_id)
    params = {
        "client_id": config.client_id,
        "redirect_uri": _callback_url(request, config.key),
        "response_type": "code",
        "scope": config.scope,
        "state": state,
        "nonce": nonce,
    }
    if config.key == "google":
        params["access_type"] = "online"

    response = RedirectResponse(f"{config.authorization_url}?{urlencode(params)}", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=_state_cookie_name(config.key),
        value=nonce,
        max_age=max(60, settings.oauth_state_ttl_seconds),
        httponly=True,
        secure=settings.oauth_cookie_secure,
        samesite="lax",
        path="/auth/oauth",
    )
    return response


def _error_redirect(provider: str, message: str) -> RedirectResponse:
    return RedirectResponse(
        _frontend_redirect({"authError": f"{provider}: {message}"}),
        status_code=status.HTTP_302_FOUND,
    )


async def _exchange_code(provider: OAuthProvider, code: str, redirect_uri: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            provider.token_url,
            data={
                "client_id": provider.client_id,
                "client_secret": provider.client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO code exchange failed")
    token_data = response.json()
    if not token_data.get("access_token"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO token response was incomplete")
    return token_data


async def _fetch_userinfo(provider: OAuthProvider, access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            provider.userinfo_url,
            headers={"Accept": "application/json", "Authorization": f"Bearer {access_token}"},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO profile lookup failed")
    profile = response.json()
    if not profile.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO profile is missing a subject")
    if not profile.get("email"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO profile did not share an email address")
    if str(profile.get("email_verified", "true")).lower() == "false":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO email address is not verified")
    return profile


def _profile_name(profile: dict[str, Any], email: str, provider: OAuthProvider) -> str:
    name = str(profile.get("name") or "").strip()
    if name:
        return name[:120]
    parts = [str(profile.get(key) or "").strip() for key in ("given_name", "family_name")]
    full_name = " ".join(part for part in parts if part)
    if full_name:
        return full_name[:120]
    return (email.split("@")[0] or f"{provider.label} User")[:120]


def _upsert_oauth_user(
    db: Session,
    *,
    provider: OAuthProvider,
    profile: dict[str, Any],
    token_data: dict[str, Any],
    plan: PlanEnum,
) -> User:
    provider_user_id = str(profile["sub"])
    email = str(profile["email"]).strip().lower()
    name = _profile_name(profile, email, provider)

    account = db.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider.key,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    )
    if account:
        user = db.scalar(select(User).where(User.id == account.user_id))
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO account is not linked to a user")
        account.provider_email = email
        account.scope = token_data.get("scope") or provider.scope
        account.access_token = None
        account.refresh_token = None
        account.expires_at = None
        user.name = user.name or name
        user.auth_provider = provider.key
        log_activity(db, user.id, "USER_LOGIN", details=f"via {provider.key}", user_name=user.name)
        return user

    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user:
        user.auth_provider = provider.key
        log_activity(db, user.id, "USER_LOGIN", details=f"linked via {provider.key}", user_name=user.name)
    else:
        user = User(
            id=new_prefixed_id("u"),
            name=name,
            email=email,
            password_hash=None,
            role=RoleEnum.user.value,
            plan=plan.value,
            status="Active",
            paid_amount=Decimal("0.00"),
            auth_provider=provider.key,
        )
        db.add(user)
        db.flush()
        details = f"via {provider.key} (Plan: {plan.value})"
        log_activity(db, user.id, "USER_SIGNUP", details=details, user_name=user.name)

    account = OAuthAccount(
        id=new_prefixed_id("oa"),
        user_id=user.id,
        provider=provider.key,
        provider_user_id=provider_user_id,
        provider_email=email,
        scope=token_data.get("scope") or provider.scope,
        access_token=None,
        refresh_token=None,
        expires_at=None,
    )
    db.add(account)
    return user


async def handle_oauth_callback(
    request: Request,
    *,
    provider: str,
    code: str | None,
    state: str | None,
    error: str | None,
    db: Session,
) -> RedirectResponse:
    config = _provider_or_404(provider)
    cookie_name = _state_cookie_name(config.key)

    if error:
        response = _error_redirect(config.key, error)
        response.delete_cookie(cookie_name, path="/auth/oauth")
        return response

    try:
        state_payload = _decode_state(config.key, state or "", request.cookies.get(cookie_name))
        if not code:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO code was not returned")
        token_data = await _exchange_code(config, code, _callback_url(request, config.key))
        profile = await _fetch_userinfo(config, str(token_data["access_token"]))
        plan = PlanEnum(str(state_payload.get("plan") or PlanEnum.free.value))
        user = _upsert_oauth_user(db, provider=config, profile=profile, token_data=token_data, plan=plan)
        db.commit()
        db.refresh(user)
        app_token = sign_token({"userId": user.id, "email": user.email, "role": user.role, "name": user.name})
        redirect_params = {"token": app_token}
        template_id = str(state_payload.get("templateId") or "").strip()
        if template_id:
            redirect_params["templateId"] = template_id
        response = RedirectResponse(_frontend_redirect(redirect_params), status_code=status.HTTP_302_FOUND)
    except HTTPException as exc:
        db.rollback()
        response = _error_redirect(config.key, str(exc.detail))
    except Exception:
        db.rollback()
        response = _error_redirect(config.key, "SSO login failed")

    response.delete_cookie(cookie_name, path="/auth/oauth")
    return response


def deprecated_provider_response():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Mock provider login is disabled. Use /auth/oauth/{provider}/start.",
    )
