from __future__ import annotations
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
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
router = APIRouter(prefix="/auth", tags=["auth"])
PROVIDER_VALUES = {"google", "linkedin", "microsoft", "github"}
@router.post("/login", response_model=TokenResponse)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    ok, needs_upgrade = verify_password(user.password_hash, payload.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if needs_upgrade:
        user.password_hash = hash_password(payload.password)
    log_activity(db, user.id, "USER_LOGIN", user_name=user.name)
    db.commit(); db.refresh(user)
    token = sign_token({"userId": user.id, "email": user.email, "role": user.role, "name": user.name})
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
@router.post("/provider", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def provider_login(payload: ProviderIn, db: Session = Depends(get_db)) -> TokenResponse:
    provider = payload.provider.strip().lower()
    if provider not in PROVIDER_VALUES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
    email = f"user@{provider}.com"
    existing = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if existing:
        log_activity(db, existing.id, "USER_LOGIN", details=f"via {provider}", user_name=existing.name)
        db.commit(); token = sign_token({"userId": existing.id, "email": existing.email, "role": existing.role, "name": existing.name})
        return TokenResponse(token=token, user=to_user_out(existing))
    user = User(id=new_prefixed_id("u"), name=f"{provider.capitalize()} User", email=email, password_hash=None, role=RoleEnum.user.value, plan=PlanEnum.free.value, status="Active", paid_amount=Decimal("0.00"), auth_provider=provider)
    db.add(user); db.flush(); log_activity(db, user.id, "USER_SIGNUP", details=f"via {provider} (Plan: free)", user_name=user.name)
    db.commit(); db.refresh(user)
    token = sign_token({"userId": user.id, "email": user.email, "role": user.role, "name": user.name})
    return TokenResponse(token=token, user=to_user_out(user))
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
def logout() -> OkResponse:
    return OkResponse(ok=True)
@router.post("/activity", response_model=OkResponse)
def activity(payload: ActivityIn, token_payload: TokenPayload = Depends(get_current_token_payload), db: Session = Depends(get_db)) -> OkResponse:
    log_activity(db, token_payload.user_id, payload.action, payload.details, user_name=token_payload.name); db.commit(); return OkResponse(ok=True)
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
    message = ContactMessage(id=new_prefixed_id("msg"), user_id=current.user_id if current else None, name=payload.name, email=payload.email, subject=payload.subject, message=payload.message, status="new")
    db.add(message); db.commit(); return IdResponse(id=message.id)
