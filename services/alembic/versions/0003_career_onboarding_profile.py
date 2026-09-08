"""career onboarding profile

Revision ID: 0003_career_onboarding_profile
Revises: 0002_career_toolkit
Create Date: 2026-09-07 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003_career_onboarding_profile"
down_revision = "0002_career_toolkit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "career_onboarding_profiles",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_experience", sa.String(length=120), nullable=False),
        sa.Column("strengths", sa.String(length=120), nullable=False),
        sa.Column("target_roles", sa.String(length=120), nullable=False),
        sa.Column("market_status", sa.String(length=120), nullable=False),
        sa.Column("short_term_goal", sa.String(length=120), nullable=False),
        sa.Column("future_goal", sa.String(length=120), nullable=False),
        sa.Column("job_preferences", sa.String(length=120), nullable=False),
        sa.Column("support_needs", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_career_onboarding_profiles_user_id"),
    )


def downgrade() -> None:
    op.drop_table("career_onboarding_profiles")
