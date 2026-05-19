import datetime
import typing as tp
import uuid

from pydantic import AliasChoices, Field

from src.common.schemas import BaseSchema
from src.notifications.enums import NotificationTypeEnum


class NotificationActorGet(BaseSchema):
    user_id: uuid.UUID
    username: str


class NotificationGet(BaseSchema):
    notification_id: uuid.UUID
    recipient_id: uuid.UUID
    notification_type: NotificationTypeEnum
    actor_id: uuid.UUID | None = None
    actor: NotificationActorGet | None = None
    content_id: uuid.UUID | None = None
    chat_id: uuid.UUID | None = None
    message_id: uuid.UUID | None = None
    title: str
    body: str | None = None
    metadata: dict[str, tp.Any] = Field(default_factory=dict)
    read_at: datetime.datetime | None = None
    created_at: datetime.datetime


class NotificationBootstrapGet(BaseSchema):
    unread_count: int = Field(default=0, ge=0)
    recent: list[NotificationGet] = Field(default_factory=list)


class NotificationUnreadCountGet(BaseSchema):
    unread_count: int = Field(default=0, ge=0)


class NotificationSettingUpdate(BaseSchema):
    is_muted: bool = Field(
        validation_alias=AliasChoices("is_muted", "isMuted"),
    )


class NotificationAuthorSettingGet(BaseSchema):
    author_id: uuid.UUID
    username: str
    display_name: str
    avatar_small_url: str | None = None
    is_muted: bool


class NotificationChatSettingGet(BaseSchema):
    chat_id: uuid.UUID
    title: str
    display_title: str
    chat_type: str
    avatar_small_url: str | None = None
    is_muted: bool


class NotificationSettingsGet(BaseSchema):
    authors: list[NotificationAuthorSettingGet] = Field(default_factory=list)
    chats: list[NotificationChatSettingGet] = Field(default_factory=list)
