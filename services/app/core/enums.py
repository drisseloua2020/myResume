from __future__ import annotations
from enum import Enum
class RoleEnum(str, Enum):
    admin = "admin"
    user = "user"
class PlanEnum(str, Enum):
    free = "free"
    monthly = "monthly"
    yearly = "yearly"
class AgentStatusEnum(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
