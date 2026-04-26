from __future__ import annotations
from app.schemas.base import StrictModel
class OkResponse(StrictModel):
    ok: bool = True
class IdResponse(StrictModel):
    id: str
class HealthResponse(StrictModel):
    status: str
