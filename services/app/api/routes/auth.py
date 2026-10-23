from __future__ import annotations
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import jwt
from app.core.config import settings
from app.schemas.auth import UpdateAccountIn, ChangePasswordIn, ForgotPasswordIn, ResetPasswordIn, DeleteAccountIn
from app.services.mailer import send_support_email
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_token_payload, get_current_user, get_db, get_optional_token_payload, require_roles
from app.api.routes.common import to_activity_log_out, to_user_out
from app.core.enums import PlanEnum, RoleEnum
from app.core.security import TokenPayload, hash_password, sign_token, verify_password
from app.models.entities import ActivityLog, ContactMessage, User
from app.schemas.auth import ActivityIn, ActivityLogsEnvelope, AdminUpdatePlanIn, ContactIn, LoginIn, ProviderIn, SignupIn, TokenResponse, UpdatePlanIn, UserEnvelope, UsersEnvelope
from app.schemas.common import IdResponse, OkResponse
from app.services.activity import log_activity, new_prefixed_id
from app.services.oauth import create_oauth_start_redirect, deprecated_provider_response, handle_oauth_callback, oauth_diagnostics
router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/providers")
def configured_providers():
    return {"providers": {provider: bool(getattr(settings, f"{provider}_oauth_client_id") and getattr(settings, f"{provider}_oauth_client_secret"))
                           for provider in ("google", "microsoft", "linkedin")}}


@router.patch("/me", response_model=UserEnvelope)
def update_account(payload: UpdateAccountIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(422, "Name is required")
    current_user.name = payload.name.strip()
    log_activity(db, current_user.id, "ACCOUNT_UPDATED", user_name=current_user.name)
    db.commit()
    return UserEnvelope(user=to_user_out(current_user))


@router.post("/me/password", response_model=OkResponse)
def change_password(payload: ChangePasswordIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(current_user.password_hash, payload.currentPassword)[0]:
        raise HTTPException(400, "Current password is incorrect")
    current_user.password_hash = hash_password(payload.newPassword)
    current_user.token_version += 1
    log_activity(db, current_user.id, "PASSWORD_CHANGED", user_name=current_user.name)
    db.commit()
    return OkResponse(ok=True)


@router.post("/forgot-password", response_model=OkResponse)
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    if not settings.smtp_host or not settings.smtp_port:
        raise HTTPException(503, "Password recovery email is not configured. Contact support.")
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user and user.password_hash and user.status == "Active":
        token = jwt.encode({"sub": user.id, "purpose": "password-reset", "version": user.token_version,
                            "exp": datetime.now(timezone.utc) + timedelta(minutes=15)}, settings.jwt_secret, algorithm="HS256")
        try:
            send_support_email(to=user.email, subject="Reset your MyResumes password",
                               text=f"Reset your password within 15 minutes: {settings.oauth_frontend_url.rstrip('/')}/#resetToken={token}\nIgnore this email if you did not request a reset.")
        except Exception as exc:
            raise HTTPException(503, "Password recovery email could not be delivered. Try again later.") from exc
    return OkResponse(ok=True)


@router.post("/reset-password", response_model=OkResponse)
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    try:
        claims = jwt.decode(payload.token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub", "version", "purpose"]})
        user = db.scalar(select(User).where(User.id == claims["sub"]).with_for_update())
        if claims["purpose"] != "password-reset" or not user or user.status != "Active" or claims["version"] != user.token_version:
            raise ValueError("Invalid token")
    except (jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(400, "Reset link is invalid, expired, or already used") from exc
    user.password_hash = hash_password(payload.newPassword)
    user.token_version += 1
    db.commit()
    return OkResponse(ok=True)


@router.get("/me/data")
def export_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.db.base import Base
    from sqlalchemy.inspection import inspect
    from fastapi.encoders import jsonable_encoder
    result = {"account": to_user_out(current_user).model_dump(mode="json"), "records": {}}
    for mapper in Base.registry.mappers:
        model = mapper.class_
        if not hasattr(model, "user_id"):
            continue
        rows = db.scalars(select(model).where(model.user_id == current_user.id)).all()
        result["records"][model.__tablename__] = [
            {column.key: jsonable_encoder(getattr(row, column.key)) for column in inspect(model).columns
             if column.key not in {"access_token", "refresh_token"}} for row in rows]
    photos = settings.upload_root / "profile-photos" / current_user.id
    import base64
    result["profilePhotos"] = [{"filename": photo.name, "base64": base64.b64encode(photo.read_bytes()).decode()}
                              for photo in photos.glob("profile-*") if photo.is_file() and not photo.is_symlink()]
    return result


@router.post("/me/delete", response_model=OkResponse)
def delete_account(payload: DeleteAccountIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.confirmationEmail.lower() != current_user.email.lower():
        raise HTTPException(400, "Enter your account email to confirm deletion")
    if current_user.password_hash and not verify_password(current_user.password_hash, payload.currentPassword)[0]:
        raise HTTPException(400, "Current password is incorrect")
    from app.db.base import Base
    from sqlalchemy import delete
    import shutil
    root = (settings.upload_root / "profile-photos").resolve()
    photos = (root / current_user.id).resolve()
    if photos.parent != root:
        raise HTTPException(400, "Invalid account upload directory")
    if photos.exists():
        shutil.rmtree(photos)
    # Delete children in reverse dependency order, including SET NULL support records.
    for table in reversed(Base.metadata.sorted_tables):
        if "user_id" in table.c:
            db.execute(delete(table).where(table.c.user_id == current_user.id))
    db.delete(current_user)
    db.commit()
    return OkResponse(ok=True)
@router.post("/login", response_model=TokenResponse)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    ok, needs_upgrade = verify_password(user.password_hash, payload.password)
    if not ok or user.status != "Active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if needs_upgrade:
        user.password_hash = hash_password(payload.password)
    log_activity(db, user.id, "USER_LOGIN", user_name=user.name)
    db.commit(); db.refresh(user)
    token = sign_token({"userId": user.id, "email": user.email, "role": user.role, "name": user.name, "version": user.token_version})
    return TokenResponse(token=token, user=to_user_out(user))
@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupIn, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(id=new_prefixed_id("u"), name=payload.name.strip(), email=payload.email.lower(), password_hash=hash_password(payload.password), role=RoleEnum.user.value, plan=PlanEnum.free.value, status="Active", paid_amount=Decimal("0.00"), auth_provider="email")
    db.add(user); db.flush()
    details = "Plan: free" + (" (requested upgrade: coming soon)" if payload.plan != PlanEnum.free else "")
    log_activity(db, user.id, "USER_SIGNUP", details=details, user_name=user.name)
    db.commit(); db.refresh(user)
    token = sign_token({"userId": user.id, "email": user.email, "role": user.role, "name": user.name})
    return TokenResponse(token=token, user=to_user_out(user))
@router.get("/oauth/{provider}/start")
def oauth_start(
    provider: str,
    request: Request,
    plan: PlanEnum = Query(default=PlanEnum.free),
    template_id: str | None = Query(default=None, alias="templateId"),
    return_to: str | None = Query(default=None, alias="returnTo"),
) -> RedirectResponse:
    return create_oauth_start_redirect(request, provider=provider, plan=plan, template_id=template_id, frontend_origin=return_to)
@router.get("/oauth/{provider}/diagnostics")
def oauth_provider_diagnostics(provider: str, request: Request) -> dict[str, object]:
    return oauth_diagnostics(request, provider)
@router.get("/oauth/{provider}/callback", name="oauth_callback")
async def oauth_callback(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    return await handle_oauth_callback(request, provider=provider, code=code, state=state, error=error, db=db)
@router.post("/provider", response_model=TokenResponse, status_code=status.HTTP_410_GONE)
def provider_login(payload: ProviderIn, db: Session = Depends(get_db)) -> TokenResponse:
    return deprecated_provider_response()
@router.get("/me", response_model=UserEnvelope)
def me(current_user: User = Depends(get_current_user)) -> UserEnvelope:
    return UserEnvelope(user=to_user_out(current_user))
@router.patch("/me/plan", response_model=UserEnvelope)
def update_my_plan(payload: UpdatePlanIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserEnvelope:
    if payload.plan != PlanEnum.free:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pro plans are coming soon. Your account remains on the Free plan.")
    if current_user.plan != PlanEnum.free.value:
        current_user.plan = PlanEnum.free.value; log_activity(db, current_user.id, "PLAN_SELECTED", details="Plan: free", user_name=current_user.name); db.commit(); db.refresh(current_user)
    return UserEnvelope(user=to_user_out(current_user))
@router.post("/logout", response_model=OkResponse)
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    current_user.token_version += 1
    db.commit()
    return OkResponse(ok=True)
@router.post("/activity", response_model=OkResponse)
def activity(payload: ActivityIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    log_activity(db, current_user.id, payload.action, payload.details, user_name=current_user.name); db.commit(); return OkResponse(ok=True)
@router.get("/users", response_model=UsersEnvelope)
def users(_admin: User = Depends(require_roles({RoleEnum.admin})), db: Session = Depends(get_db)) -> UsersEnvelope:
    rows = db.scalars(select(User).order_by(desc(User.created_at))).all(); return UsersEnvelope(users=[to_user_out(item) for item in rows])
@router.get("/logs", response_model=ActivityLogsEnvelope)
def logs(_admin: User = Depends(require_roles({RoleEnum.admin})), db: Session = Depends(get_db)) -> ActivityLogsEnvelope:
    rows = db.scalars(select(ActivityLog).order_by(desc(ActivityLog.timestamp))).all(); return ActivityLogsEnvelope(logs=[to_activity_log_out(item) for item in rows])
@router.patch("/users/{user_id}/plan", response_model=UserEnvelope)
def update_user_plan(user_id: str, payload: AdminUpdatePlanIn, _admin: User = Depends(require_roles({RoleEnum.admin})), db: Session = Depends(get_db)) -> UserEnvelope:
    if payload.plan != PlanEnum.free:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pro plans are coming soon. Only the Free plan is available.")
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.plan = PlanEnum.free.value; log_activity(db, user.id, "PLAN_SELECTED", details="Switched to free", user_name=user.name); db.commit(); db.refresh(user)
    return UserEnvelope(user=to_user_out(user))
@router.post("/contact", response_model=IdResponse)
def contact(payload: ContactIn, db: Session = Depends(get_db), current: TokenPayload | None = Depends(get_optional_token_payload)) -> IdResponse:
    if current:
        user = db.get(User, current.user_id)
        if not user or user.status != 'Active' or user.token_version != current.version:
            raise HTTPException(401, "Session expired")
    message = ContactMessage(id=new_prefixed_id("msg"), user_id=current.user_id if current else None, name=payload.name, email=payload.email, subject=payload.subject, message=payload.message, status="new")
    db.add(message); db.commit(); return IdResponse(id=message.id)
