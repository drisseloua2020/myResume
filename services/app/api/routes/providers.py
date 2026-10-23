"""Opt-in development provider sandbox; never a fallback for live integrations."""
from hashlib import sha256
from datetime import datetime, timezone
import json
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.entities import JobApplication, ProviderOperation, Resume, User
from app.schemas.base import StrictModel
from app.services.activity import log_activity, new_prefixed_id
from app.services.mock_providers import MOCK_JOBS, PROVIDER_ACTIONS, mock_result

router = APIRouter(prefix="/providers", tags=["provider-demo"])


def demo_enabled() -> bool:
    return settings.mock_providers_enabled and settings.app_env != "production"


def require_demo():
    if not demo_enabled():
        raise HTTPException(404, "Mock providers are disabled")


@router.get("/capabilities")
def capabilities():
    return {"demoEnabled": demo_enabled(), "mode": "mock" if demo_enabled() else "disabled", "liveIntegrations": False}


class DemoRequest(StrictModel):
    provider: Literal["billing", "email", "jobs", "profile", "applications"]
    action: Literal["checkout", "cancel", "send", "discover", "save", "connect", "sync", "disconnect", "submit"]
    scenario: Literal["success", "failure", "timeout"] = "success"
    subjectId: str | None = Field(default=None, max_length=64)
    plan: Literal["pro_monthly", "pro_yearly"] = "pro_monthly"
    idempotencyKey: str = Field(min_length=16, max_length=64)


def operation_out(row: ProviderOperation):
    return {"id": row.id, "provider": row.provider, "action": row.action, "subjectId": row.subject_id,
            "status": row.status, "result": row.result, "createdAt": row.created_at, "mode": "mock"}


@router.get("/demo/operations", dependencies=[Depends(require_demo)])
def list_operations(offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=200),
                    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(ProviderOperation).where(ProviderOperation.user_id == current_user.id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(desc(ProviderOperation.created_at), desc(ProviderOperation.id)).offset(offset).limit(limit)).all()
    return {"operations": [operation_out(row) for row in rows], "total": total, "mode": "mock"}


@router.get("/demo/state", dependencies=[Depends(require_demo)])
def state(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    def latest(provider, actions, subject=None):
        query = select(ProviderOperation).where(ProviderOperation.user_id == current_user.id,
            ProviderOperation.provider == provider, ProviderOperation.status == "succeeded", ProviderOperation.action.in_(actions))
        if subject:
            query = query.where(ProviderOperation.subject_id == subject)
        return db.scalar(query.order_by(desc(ProviderOperation.created_at), desc(ProviderOperation.id)).limit(1))
    billing = latest("billing", ["checkout", "cancel"])
    profiles = {}
    for source in ("github", "linkedin"):
        connection = latest("profile", ["connect", "disconnect"], source)
        profiles[source] = bool(connection and connection.action == "connect")
    return {"mode": "mock", "profiles": profiles, "billing": billing.result if billing else {"plan": "free", "subscriptionStatus": "inactive", "entitlementsChanged": False}}


@router.post("/demo/execute", dependencies=[Depends(require_demo)])
def execute(payload: DemoRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.action not in PROVIDER_ACTIONS[payload.provider]:
        raise HTTPException(422, "Action is not supported by this mock provider")
    db.scalar(select(User).where(User.id == current_user.id).with_for_update())
    request_data = payload.model_dump(exclude={"idempotencyKey"})
    request_hash = sha256(json.dumps(request_data, sort_keys=True).encode()).hexdigest()
    previous = db.scalar(select(ProviderOperation).where(ProviderOperation.user_id == current_user.id,
        ProviderOperation.provider == payload.provider, ProviderOperation.idempotency_key == payload.idempotencyKey))
    if previous:
        if previous.request_hash != request_hash:
            raise HTTPException(409, "Idempotency key was already used for different inputs")
        return {"operation": operation_out(previous), "replayed": True}

    effect_key = None
    context = {}
    fixture = None
    if payload.provider == "profile":
        if payload.subjectId not in {"github", "linkedin"}:
            raise HTTPException(422, "Choose a supported demo profile source")
        last_connection = db.scalar(select(ProviderOperation).where(ProviderOperation.user_id == current_user.id,
            ProviderOperation.provider == "profile", ProviderOperation.subject_id == payload.subjectId,
            ProviderOperation.action.in_(["connect", "disconnect"]), ProviderOperation.status == "succeeded")
            .order_by(desc(ProviderOperation.created_at), desc(ProviderOperation.id)).limit(1))
        if payload.action == "sync" and (not last_connection or last_connection.action != "connect"):
            raise HTTPException(409, "Connect the demo source before syncing")
    if payload.provider == "jobs" and payload.action == "save":
        fixture = next((job for job in MOCK_JOBS if job["id"] == payload.subjectId), None)
        if not fixture:
            raise HTTPException(404, "Demo job not found")
        effect_key = f"saved:{fixture['id']}"
    if payload.provider == "applications":
        job = db.scalar(select(JobApplication).where(JobApplication.id == payload.subjectId,
            JobApplication.user_id == current_user.id).with_for_update())
        if not job:
            raise HTTPException(404, "Job not found")
        packet = job.packet if isinstance(job.packet, dict) else {}
        resume = db.get(Resume, job.resume_id) if job.resume_id else None
        current_hash = sha256(json.dumps(resume.content, sort_keys=True, ensure_ascii=False).encode()).hexdigest() if resume else None
        if packet.get("decision") != "approved" or not packet.get("id") or packet.get("resumeHash") != current_hash:
            raise HTTPException(409, "Prepare and approve a current packet before simulated submission")
        effect_key = f"submitted:{packet['id']}"
        context = {"jobId": job.id, "packetId": packet["id"], "jobTitle": job.title}
    if effect_key:
        completed = db.scalar(select(ProviderOperation).where(ProviderOperation.user_id == current_user.id,
            ProviderOperation.provider == payload.provider, ProviderOperation.effect_key == effect_key))
        if completed:
            return {"operation": operation_out(completed), "replayed": True}

    operation_id = new_prefixed_id("mock")
    succeeded = payload.scenario == "success"
    if succeeded:
        result = {**mock_result(payload.provider, payload.action, subject=payload.subjectId,
                               plan=payload.plan, receipt=f"mock-receipt-{operation_id}"), **context}
        if fixture:
            job = db.scalar(select(JobApplication).where(JobApplication.user_id == current_user.id, JobApplication.job_url == fixture["jobUrl"]))
            if not job:
                job = JobApplication(id=new_prefixed_id("job"), user_id=current_user.id, status="saved",
                    title=fixture["title"], company=fixture["company"], location=fixture["location"],
                    job_url=fixture["jobUrl"], job_description=fixture["jobDescription"],
                    notes="[MOCK PROVIDER] Synthetic job for testing. Not a real vacancy.")
                db.add(job)
            result["jobId"] = job.id
            result["synthetic"] = True
    else:
        result = {"error": "Simulated provider timeout" if payload.scenario == "timeout" else "Simulated provider failure",
                  "retryable": True, "externalEffects": False}
    row = ProviderOperation(id=operation_id, user_id=current_user.id, provider=payload.provider,
        action=payload.action, subject_id=payload.subjectId, idempotency_key=payload.idempotencyKey,
        effect_key=effect_key if succeeded else None, request_hash=request_hash,
        status="succeeded" if succeeded else "failed", result=result, created_at=datetime.now(timezone.utc))
    db.add(row)
    log_activity(db, current_user.id, "MOCK_PROVIDER_OPERATION", details=f"Provider: {payload.provider}; action: {payload.action}; status: {row.status}", user_name=current_user.name)
    db.commit()
    db.refresh(row)
    return {"operation": operation_out(row), "replayed": False}
