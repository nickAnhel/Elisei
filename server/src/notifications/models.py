import datetime
import typing as tp
import uuid

from sqlalchemy import JSON, CheckConstraint, DateTime, Enum, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.models import Base
from src.notifications.enums import NotificationTypeEnum


def _enum_values(enum_cls):  # type: ignore[no-untyped-def]
    return [item.value for item in enum_cls]


class NotificationModel(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
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
        Index("ix_notifications_recipient_created_at", "recipient_id", text("created_at DESC")),
        Index("ix_notifications_recipient_read_at", "recipient_id", "read_at"),
        Index(
            "ix_notifications_recipient_type_created_at",
            "recipient_id",
            "notification_type",
            text("created_at DESC"),
        ),
        Index(
            "uq_notifications_publication_recipient_content",
            "recipient_id",
            "content_id",
            unique=True,
            postgresql_where=text("notification_type = 'publication' AND content_id IS NOT NULL"),
        ),
        Index(
            "uq_notifications_messenger_recipient_message",
            "recipient_id",
            "message_id",
            unique=True,
            postgresql_where=text("notification_type = 'messenger' AND message_id IS NOT NULL"),
        ),
    )

    notification_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
    )
    notification_type: Mapped[NotificationTypeEnum] = mapped_column(
        Enum(NotificationTypeEnum, name="notification_type_enum", values_callable=_enum_values),
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    content_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("content.content_id", ondelete="CASCADE"),
        nullable=True,
    )
    chat_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chats.chat_id", ondelete="CASCADE"),
        nullable=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("messages.message_id", ondelete="CASCADE"),
        nullable=True,
    )

    title: Mapped[str]
    body: Mapped[str | None] = mapped_column(Text(), nullable=True)
    notification_metadata: Mapped[dict[str, tp.Any]] = mapped_column(
        "metadata",
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    read_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        server_default=text("now()"),
    )

    recipient: Mapped["UserModel"] = relationship(  # type: ignore[name-defined]
        foreign_keys=[recipient_id],
        passive_deletes=True,
    )
    actor: Mapped["UserModel | None"] = relationship(  # type: ignore[name-defined]
        foreign_keys=[actor_id],
        passive_deletes=True,
    )
    content: Mapped["ContentModel | None"] = relationship(  # type: ignore[name-defined]
        foreign_keys=[content_id],
        passive_deletes=True,
    )
    chat: Mapped["ChatModel | None"] = relationship(  # type: ignore[name-defined]
        foreign_keys=[chat_id],
        passive_deletes=True,
    )
    message: Mapped["MessageModel | None"] = relationship(  # type: ignore[name-defined]
        foreign_keys=[message_id],
        passive_deletes=True,
    )
