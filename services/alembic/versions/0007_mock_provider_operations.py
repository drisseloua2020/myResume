"""Persist isolated mock-provider requests and replay-safe receipts."""
from alembic import op
import sqlalchemy as sa

revision = "0007_mock_provider_operations"
down_revision = "0006_import_idempotency"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "provider_operations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("subject_id", sa.String(64), nullable=True),
        sa.Column("idempotency_key", sa.String(64), nullable=False),
        sa.Column("effect_key", sa.String(100), nullable=True),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "provider", "idempotency_key", name="uq_provider_operation_request"),
        sa.UniqueConstraint("user_id", "provider", "effect_key", name="uq_provider_operation_effect"),
    )
    op.create_index("ix_provider_operations_user_created", "provider_operations", ["user_id", "created_at"])


def downgrade():
    op.drop_table("provider_operations")
