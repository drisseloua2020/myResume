"""Revoke sessions and isolate drafts by saved resume."""
from alembic import op
import sqlalchemy as sa

revision = "0005_sessions_and_drafts"
down_revision = "0004_career_profile_analysis"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("resume_drafts", sa.Column("draft_key", sa.String(100), nullable=True))
    op.execute("UPDATE resume_drafts SET draft_key = 'new:' || template_id")
    with op.batch_alter_table("resume_drafts") as batch:
        batch.alter_column("draft_key", existing_type=sa.String(100), nullable=False)
        batch.add_column(sa.Column("resume_id", sa.String(64), nullable=True))
        batch.create_foreign_key("fk_draft_resume", "resumes", ["resume_id"], ["id"], ondelete="CASCADE")
        batch.drop_constraint("uq_resume_drafts_user_template", type_="unique")
        batch.create_unique_constraint("uq_resume_drafts_user_key", ["user_id", "draft_key"])
    for table in ("activity_logs", "resume_drafts", "resume_versions", "achievements", "job_applications", "cover_letters"):
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])


def downgrade():
    raise RuntimeError("Export drafts before downgrade; this migration is intentionally forward-only")
