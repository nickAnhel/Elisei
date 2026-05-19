"""add notifications

Revision ID: f9a8b7c6d5e4
Revises: a7b8c9d0e1f2
Create Date: 2026-05-19 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9a8b7c6d5e4"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    notification_type_enum = sa.dialects.postgresql.ENUM(
        "publication",
        "messenger",
        name="notification_type_enum",
    )
    notification_type_enum.create(bind, checkfirst=True)

    op.add_column(
        "subscriptions",
        sa.Column(
            "is_muted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "notifications",
        sa.Column("notification_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), nullable=False),
        sa.Column(
            "notification_type",
            sa.dialects.postgresql.ENUM(
                "publication",
                "messenger",
                name="notification_type_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("content_id", sa.Uuid(), nullable=True),
        sa.Column("chat_id", sa.Uuid(), nullable=True),
        sa.Column("message_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column(
            "metadata",
            sa.JSON().with_variant(sa.dialects.postgresql.JSONB, "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["content_id"], ["content.content_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["chat_id"], ["chats.chat_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.message_id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            """
            (
                notification_type = 'publication'
                and content_id is not null
                and chat_id is null
                and message_id is null
            )
            or
            (
                notification_type = 'messenger'
                and chat_id is not null
                and message_id is not null
                and content_id is null
            )
            """,
            name="ck_notifications_type_refs",
        ),
        sa.PrimaryKeyConstraint("notification_id"),
    )

    op.create_index(
        "ix_notifications_recipient_created_at",
        "notifications",
        ["recipient_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_notifications_recipient_read_at",
        "notifications",
        ["recipient_id", "read_at"],
    )
    op.create_index(
        "ix_notifications_recipient_type_created_at",
        "notifications",
        ["recipient_id", "notification_type", sa.text("created_at DESC")],
    )
    op.create_index(
        "uq_notifications_publication_recipient_content",
        "notifications",
        ["recipient_id", "content_id"],
        unique=True,
        postgresql_where=sa.text("notification_type = 'publication' AND content_id IS NOT NULL"),
    )
    op.create_index(
        "uq_notifications_messenger_recipient_message",
        "notifications",
        ["recipient_id", "message_id"],
        unique=True,
        postgresql_where=sa.text("notification_type = 'messenger' AND message_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_column("subscriptions", "is_muted")

    bind = op.get_bind()
    notification_type_enum = sa.Enum(
        "publication",
        "messenger",
        name="notification_type_enum",
    )
    notification_type_enum.drop(bind, checkfirst=True)
