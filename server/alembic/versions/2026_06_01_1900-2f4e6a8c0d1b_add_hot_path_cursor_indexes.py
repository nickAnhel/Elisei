"""add hot-path cursor indexes

Revision ID: 2f4e6a8c0d1b
Revises: 1c2d3e4f5b6a
Create Date: 2026-06-01 19:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2f4e6a8c0d1b"
down_revision: Union[str, None] = "1c2d3e4f5b6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_content_feed_cursor_public_live",
        "content",
        [
            "status",
            "visibility",
            sa.text("published_at DESC"),
            sa.text("content_id DESC"),
        ],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_content_author_created_cursor_live",
        "content",
        [
            "author_id",
            "status",
            "visibility",
            sa.text("created_at DESC"),
            sa.text("content_id DESC"),
        ],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_content_author_public_published_cursor_live",
        "content",
        [
            "author_id",
            sa.text("published_at DESC"),
            sa.text("content_id DESC"),
        ],
        unique=False,
        postgresql_where=sa.text("status = 'published' AND visibility = 'public' AND deleted_at IS NULL"),
    )
    op.create_index(
        "ix_messages_chat_created_id_live",
        "messages",
        [
            "chat_id",
            sa.text("created_at DESC"),
            sa.text("message_id DESC"),
        ],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_comments_root_live",
        "comments",
        [
            "content_id",
            "parent_comment_id",
            sa.text("created_at DESC"),
        ],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_comments_replies_live",
        "comments",
        [
            "parent_comment_id",
            "root_comment_id",
            sa.text("created_at ASC"),
        ],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_subscriptions_subscribed_subscriber",
        "subscriptions",
        ["subscribed_id", "subscriber_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_subscriptions_subscribed_subscriber", table_name="subscriptions")
    op.drop_index("ix_comments_replies_live", table_name="comments")
    op.drop_index("ix_comments_root_live", table_name="comments")
    op.drop_index("ix_messages_chat_created_id_live", table_name="messages")
    op.drop_index("ix_content_author_public_published_cursor_live", table_name="content")
    op.drop_index("ix_content_author_created_cursor_live", table_name="content")
    op.drop_index("ix_content_feed_cursor_public_live", table_name="content")
