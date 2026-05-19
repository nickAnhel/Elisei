from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from src.notifications.enums import NotificationFilterEnum, NotificationTypeEnum
from src.notifications.exceptions import (
    NotificationAuthorSettingsNotFound,
    NotificationChatSettingsNotFound,
    NotificationNotFound,
)
from src.notifications.repository import NotificationRepository
from src.notifications.schemas import (
    NotificationActorGet,
    NotificationAuthorSettingGet,
    NotificationBootstrapGet,
    NotificationChatSettingGet,
    NotificationGet,
    NotificationSettingsGet,
    NotificationUnreadCountGet,
)
from src.users.presentation import build_user_avatar_get

if TYPE_CHECKING:
    from src.assets.storage import AssetStorage


class NotificationService:
    def __init__(
        self,
        repository: NotificationRepository,
        avatar_storage: AssetStorage | None = None,
    ) -> None:
        self._repository = repository
        self._avatar_storage = avatar_storage

    async def create_publication_notifications(
        self,
        *,
        actor_id: uuid.UUID,
        content_id: uuid.UUID,
        content_type: str,
        title: str,
        body: str | None,
        canonical_path: str,
    ) -> list[NotificationGet]:
        recipient_ids = await self._repository.get_publication_recipient_ids(author_id=actor_id)
        notifications = await self._repository.create_publication_notifications(
            recipient_ids=recipient_ids,
            actor_id=actor_id,
            content_id=content_id,
            title=title,
            body=body,
            metadata={
                "content_type": content_type,
                "canonical_path": canonical_path,
            },
        )
        payload = [self._build_notification_get(item) for item in notifications]
        for item in payload:
            await self._emit_created(item)
        return payload

    async def create_messenger_notifications(
        self,
        *,
        sender_id: uuid.UUID,
        sender_username: str,
        chat_id: uuid.UUID,
        message_id: uuid.UUID,
        message_preview: str,
    ) -> list[NotificationGet]:
        recipient_ids = await self._repository.get_messenger_recipient_ids(
            chat_id=chat_id,
            sender_id=sender_id,
        )
        notifications = await self._repository.create_messenger_notifications(
            recipient_ids=recipient_ids,
            actor_id=sender_id,
            chat_id=chat_id,
            message_id=message_id,
            title=f"New message from {sender_username}",
            body=message_preview,
            metadata={
                "chat_id": str(chat_id),
            },
        )
        payload = [self._build_notification_get(item) for item in notifications]
        for item in payload:
            await self._emit_created(item)
        return payload

    async def get_bootstrap(
        self,
        *,
        recipient_id: uuid.UUID,
        limit: int = 20,
    ) -> NotificationBootstrapGet:
        unread_count = await self._repository.get_unread_count(recipient_id=recipient_id)
        recent = await self._repository.get_multi(
            recipient_id=recipient_id,
            notification_type=None,
            limit=limit,
            before=None,
        )
        return NotificationBootstrapGet(
            unread_count=unread_count,
            recent=[self._build_notification_get(item) for item in recent],
        )

    async def get_notifications(
        self,
        *,
        recipient_id: uuid.UUID,
        notification_filter: NotificationFilterEnum,
        limit: int,
        before: datetime.datetime | None,
    ) -> list[NotificationGet]:
        notification_type = self._map_filter_to_type(notification_filter)
        notifications = await self._repository.get_multi(
            recipient_id=recipient_id,
            notification_type=notification_type,
            limit=limit,
            before=before,
        )
        return [self._build_notification_get(item) for item in notifications]

    async def get_unread_count(self, *, recipient_id: uuid.UUID) -> NotificationUnreadCountGet:
        unread_count = await self._repository.get_unread_count(recipient_id=recipient_id)
        return NotificationUnreadCountGet(unread_count=unread_count)

    async def mark_read(
        self,
        *,
        notification_id: uuid.UUID,
        recipient_id: uuid.UUID,
    ) -> NotificationGet:
        notification = await self._repository.mark_read(
            notification_id=notification_id,
            recipient_id=recipient_id,
        )
        if notification is None:
            raise NotificationNotFound(f"Notification with id '{notification_id}' not found")
        return self._build_notification_get(notification)

    async def mark_all_read(self, *, recipient_id: uuid.UUID) -> int:
        return await self._repository.mark_all_read(recipient_id=recipient_id)

    async def get_settings(self, *, user_id: uuid.UUID) -> NotificationSettingsGet:
        authors = await self._repository.get_author_settings(subscriber_id=user_id)
        chats = await self._repository.get_chat_settings(user_id=user_id)
        author_payload = [
            await self._build_author_setting_get(item)
            for item in authors
        ]
        chat_payload = [
            await self._build_chat_setting_get(item, current_user_id=user_id)
            for item in chats
        ]
        return NotificationSettingsGet(
            authors=author_payload,
            chats=chat_payload,
        )

    async def update_author_setting(
        self,
        *,
        user_id: uuid.UUID,
        author_id: uuid.UUID,
        is_muted: bool,
    ) -> NotificationAuthorSettingGet:
        updated = await self._repository.update_author_muted(
            subscriber_id=user_id,
            author_id=author_id,
            is_muted=is_muted,
        )
        if not updated:
            raise NotificationAuthorSettingsNotFound(
                f"Subscription for author '{author_id}' not found"
            )
        updated_setting = await self._repository.get_author_setting(
            subscriber_id=user_id,
            author_id=author_id,
        )
        if updated_setting is None:
            raise NotificationAuthorSettingsNotFound(
                f"Subscription for author '{author_id}' not found"
            )
        return await self._build_author_setting_get(updated_setting)

    async def update_chat_setting(
        self,
        *,
        user_id: uuid.UUID,
        chat_id: uuid.UUID,
        is_muted: bool,
    ) -> NotificationChatSettingGet:
        updated = await self._repository.update_chat_muted(
            user_id=user_id,
            chat_id=chat_id,
            is_muted=is_muted,
        )
        if not updated:
            raise NotificationChatSettingsNotFound(
                f"Chat settings for chat '{chat_id}' not found"
            )
        updated_setting = await self._repository.get_chat_setting(
            user_id=user_id,
            chat_id=chat_id,
        )
        if updated_setting is None:
            raise NotificationChatSettingsNotFound(
                f"Chat settings for chat '{chat_id}' not found"
            )
        return await self._build_chat_setting_get(
            updated_setting,
            current_user_id=user_id,
        )

    def _build_notification_get(self, notification) -> NotificationGet:  # type: ignore[no-untyped-def]
        actor = getattr(notification, "actor", None)
        actor_payload = None
        if actor is not None:
            actor_payload = NotificationActorGet(
                user_id=actor.user_id,
                username=actor.username,
            )

        return NotificationGet(
            notification_id=notification.notification_id,
            recipient_id=notification.recipient_id,
            notification_type=notification.notification_type,
            actor_id=notification.actor_id,
            actor=actor_payload,
            content_id=notification.content_id,
            chat_id=notification.chat_id,
            message_id=notification.message_id,
            title=notification.title,
            body=notification.body,
            metadata=getattr(notification, "notification_metadata", {}) or {},
            read_at=notification.read_at,
            created_at=notification.created_at,
        )

    async def _emit_created(self, notification: NotificationGet) -> None:
        from src.chats import sockets as chat_sockets

        await chat_sockets.sio.emit(
            "notification:created",
            notification.model_dump(mode="json"),
            room=f"user:{notification.recipient_id}",
        )

    async def _build_author_setting_get(
        self,
        author_setting,
    ) -> NotificationAuthorSettingGet:  # type: ignore[no-untyped-def]
        author = author_setting.author
        avatar_small_url = await self._resolve_avatar_small_url(author)
        display_name = author.display_name or author.username
        return NotificationAuthorSettingGet(
            author_id=author.user_id,
            username=author.username,
            display_name=display_name,
            avatar_small_url=avatar_small_url,
            is_muted=author_setting.is_muted,
        )

    async def _build_chat_setting_get(
        self,
        chat_setting,
        *,
        current_user_id: uuid.UUID,
    ) -> NotificationChatSettingGet:  # type: ignore[no-untyped-def]
        chat = chat_setting.chat
        display_title = chat.title
        avatar_small_url = None

        if chat.chat_type == "direct":
            other_user = next(
                (member for member in (chat.members or []) if member.user_id != current_user_id),
                None,
            )
            if other_user is not None:
                display_title = other_user.display_name or other_user.username
                avatar_small_url = await self._resolve_avatar_small_url(other_user)
            else:
                display_title = chat.title
        return NotificationChatSettingGet(
            chat_id=chat.chat_id,
            title=chat.title,
            display_title=display_title,
            chat_type=chat.chat_type,
            avatar_small_url=avatar_small_url,
            is_muted=chat_setting.is_muted,
        )

    async def _resolve_avatar_small_url(self, user) -> str | None:  # type: ignore[no-untyped-def]
        direct_url = getattr(user, "avatar_small_url", None)
        if isinstance(direct_url, str) and direct_url:
            return direct_url

        avatar = await build_user_avatar_get(
            user,
            storage=self._avatar_storage,
        )
        if avatar is None:
            return None
        return avatar.small_url

    def _map_filter_to_type(
        self,
        notification_filter: NotificationFilterEnum,
    ) -> NotificationTypeEnum | None:
        if notification_filter == NotificationFilterEnum.PUBLICATION:
            return NotificationTypeEnum.PUBLICATION
        if notification_filter == NotificationFilterEnum.MESSENGER:
            return NotificationTypeEnum.MESSENGER
        return None
