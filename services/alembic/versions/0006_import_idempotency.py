"""Make import retries idempotent without merging intentional re-imports."""
from alembic import op
import sqlalchemy as sa

revision = "0006_import_idempotency"
down_revision = "0005_sessions_and_drafts"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("resumes") as batch:
        batch.add_column(sa.Column("creation_key", sa.String(64), nullable=True))
        batch.create_unique_constraint("uq_resumes_user_creation_key", ["user_id", "creation_key"])


def downgrade():
    with op.batch_alter_table("resumes") as batch:
        batch.drop_constraint("uq_resumes_user_creation_key", type_="unique")
        batch.drop_column("creation_key")
