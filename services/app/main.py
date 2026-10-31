from __future__ import annotations
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.admin import router as admin_router
from app.api.routes.agent import router as agent_router
from app.api.routes.auth import router as auth_router
from app.api.routes.career import router as career_router
from app.api.routes.cover_letters import router as cover_letters_router
from app.api.routes.profile import router as profile_router
from app.api.routes.providers import router as providers_router
from app.api.routes.resumes import router as resumes_router
from app.api.routes.uploads import router as uploads_router
from app.core.config import DATABASE_SCHEMA_REVISION, settings
from app.db.diagnostics import database_error_code
from app.db.session import configure_engine, dispose_engine, get_engine
from app.core.middleware import RequestPolicyMiddleware
from app.schemas.common import HealthResponse
@asynccontextmanager
async def lifespan(_: FastAPI):
    import logging
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    settings.validate_runtime_settings(); configure_engine()
    try:
        yield
    finally:
        dispose_engine()
class ApiApplication(FastAPI):
    def build_middleware_stack(self):
        # CORS must also wrap server errors, not only successful route responses.
        return CORSMiddleware(super().build_middleware_stack(), allow_origins=settings.allowed_origins,
                              allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app = ApiApplication(title="ResumeForge API - Python", version="2.0.0", lifespan=lifespan)
app.add_middleware(RequestPolicyMiddleware)

@app.exception_handler(IntegrityError)
async def record_conflict(_, __):
    return JSONResponse({"detail": "Record conflict. Reload and retry."}, status_code=409)

@app.exception_handler(SQLAlchemyError)
async def database_failure(request, error):
    import logging
    code = database_error_code(error)
    logging.getLogger("myresume.database").error(
        "database_request_failed request_id=%s error_type=%s sqlstate=%s",
        getattr(request.state, "request_id", "unavailable"), type(error).__name__, code or "unknown")
    detail = "Database temporarily unavailable. Please try again later."
    if code in {"42703", "42P01"}:
        detail = "Database schema is not up to date. An administrator must apply the database migrations."
    return JSONResponse({"detail": detail}, status_code=503)
@app.get('/health', response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status='ok')

@app.get('/ready')
def ready():
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
            revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
            if revision != DATABASE_SCHEMA_REVISION:
                raise RuntimeError("Pending migrations")
    except Exception as exc:
        raise HTTPException(503, "Database unavailable or migrations pending") from exc
    return {"status": "ready"}
app.include_router(auth_router)
app.include_router(agent_router)
app.include_router(resumes_router)
app.include_router(cover_letters_router)
app.include_router(career_router)
app.include_router(profile_router)
app.include_router(providers_router)
app.include_router(admin_router)
app.include_router(uploads_router)
Path(settings.upload_root).mkdir(parents=True, exist_ok=True)
