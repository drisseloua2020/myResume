"""career toolkit tables

Revision ID: 0002_career_toolkit
Revises: 0001_initial
Create Date: 2026-08-11 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_career_toolkit"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resume_versions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resume_id", sa.String(length=64), sa.ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("job_application_id", sa.String(length=64), nullable=True),
        sa.Column("kind", sa.String(length=40), nullable=False, server_default="base"),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("locale", sa.String(length=40), nullable=True),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "resume_shares",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resume_id", sa.String(length=64), sa.ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("redact_pii", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_resume_shares_slug", "resume_shares", ["slug"], unique=True)
    op.create_table(
        "achievements",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False, server_default="General"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("metrics", sa.String(length=255), nullable=True),
        sa.Column("source_resume_id", sa.String(length=64), sa.ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "job_applications",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="saved"),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("job_url", sa.Text(), nullable=True),
        sa.Column("job_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("salary", sa.String(length=120), nullable=True),
        sa.Column("contact_name", sa.String(length=160), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("deadline", sa.String(length=40), nullable=True),
        sa.Column("resume_id", sa.String(length=64), sa.ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cover_letter_id", sa.String(length=64), sa.ForeignKey("cover_letters.id", ondelete="SET NULL"), nullable=True),
        sa.Column("packet", sa.JSON(), nullable=True),
        sa.Column("reminders", sa.JSON(), nullable=True),
        sa.Column("saved_answers", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("job_applications")
    op.drop_table("achievements")
    op.drop_index("ix_resume_shares_slug", table_name="resume_shares")
    op.drop_table("resume_shares")
    op.drop_table("resume_versions")
