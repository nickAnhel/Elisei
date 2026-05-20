"""add chat avatars

Revision ID: 1c2d3e4f5b6a
Revises: f9a8b7c6d5e4
Create Date: 2026-05-19 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "1c2d3e4f5b6a"
down_revision: Union[str, None] = "f9a8b7c6d5e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chats",
        sa.Column("avatar_asset_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "chats",
        sa.Column(
            "avatar_crop",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_chats_avatar_asset_id_assets",
        "chats",
        "assets",
        ["avatar_asset_id"],
        ["asset_id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_chats_avatar_asset_id", "chats", ["avatar_asset_id"])


def downgrade() -> None:
    op.drop_index("ix_chats_avatar_asset_id", table_name="chats")
    op.drop_constraint("fk_chats_avatar_asset_id_assets", "chats", type_="foreignkey")
    op.drop_column("chats", "avatar_crop")
    op.drop_column("chats", "avatar_asset_id")
