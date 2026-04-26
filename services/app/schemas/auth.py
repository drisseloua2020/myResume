from __future__ import annotations
from datetime import datetime
from pydantic import EmailStr, Field
from app.core.enums import PlanEnum, RoleEnum
from app.schemas.base import StrictModel
class LoginIn(StrictModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=256)
class SignupIn(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=256)
    plan: PlanEnum = PlanEnum.free
class ProviderIn(StrictModel):
    provider: str = Field(min_length=2, max_length=40)
    plan: PlanEnum = PlanEnum.free
class UpdatePlanIn(StrictModel):
    plan: PlanEnum
class AdminUpdatePlanIn(StrictModel):
    plan: PlanEnum
    amount: str = Field(min_length=1, max_length=32)
class ActivityIn(StrictModel):
    action: str = Field(min_length=1, max_length=80)
    details: str | None = Field(default=None, max_length=4000)
class ContactIn(StrictModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=2, max_length=160)
    message: str = Field(min_length=5, max_length=5000)
class UserOut(StrictModel):
    id: str
    name: str
    email: EmailStr
    role: RoleEnum
    plan: PlanEnum
    status: str
    createdAt: datetime | None = None
    paidAmount: str
    authProvider: str
class TokenResponse(StrictModel):
    token: str
    user: UserOut
class UserEnvelope(StrictModel):
    user: UserOut
class UsersEnvelope(StrictModel):
    users: list[UserOut]
class ActivityLogOut(StrictModel):
    id: str
    userId: str
    userName: str
    action: str
    details: str | None = None
    timestamp: datetime
class ActivityLogsEnvelope(StrictModel):
    logs: list[ActivityLogOut]
