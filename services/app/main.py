from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.admin import router as admin_router
from app.api.routes.agent import router as agent_router
from app.api.routes.auth import router as auth_router
from app.api.routes.cover_letters import router as cover_letters_router
from app.api.routes.profile import router as profile_router
from app.api.routes.resumes import router as resumes_router
from app.core.config import settings
from app.db.session import configure_engine, dispose_engine
from app.schemas.common import HealthResponse
@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.validate_runtime_settings(); configure_engine()
    try:
        yield
    finally:
        dispose_engine()
app = FastAPI(title="ResumeForge API - Python", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
@app.get('/health', response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status='ok')
app.include_router(auth_router)
app.include_router(agent_router)
app.include_router(resumes_router)
app.include_router(cover_letters_router)
app.include_router(profile_router)
app.include_router(admin_router)
