"""career profile analysis

Revision ID: 0004_career_profile_analysis
Revises: 0003_career_onboarding_profile
Create Date: 2026-09-07 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0004_career_profile_analysis"
down_revision = "0003_career_onboarding_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "career_profile_analyses",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("onboarding_profile_id", sa.String(length=64), sa.ForeignKey("career_onboarding_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resume_id", sa.String(length=64), sa.ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("profile_category", sa.String(length=160), nullable=False),
        sa.Column("resume_category", sa.String(length=160), nullable=False),
        sa.Column("recommended_job_family", sa.String(length=200), nullable=False),
        sa.Column("skill_focus", sa.String(length=200), nullable=False),
        sa.Column("analysis", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_career_profile_analyses_user_id"),
    )


def downgrade() -> None:
    op.drop_table("career_profile_analyses")
