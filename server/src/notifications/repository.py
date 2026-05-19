from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import desc, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.assets.models import AssetModel
from src.chats.models import ChatModel, MembershipModel
from src.notifications.enums import NotificationTypeEnum
from src.notifications.models import NotificationModel
from src.users.models import SubscriptionModel, UserModel


@dataclass(slots=True)
class NotificationAuthorSettingRow:
    author: UserModel
    is_muted: bool


@dataclass(slots=True)
class NotificationChatSettingRow:
    chat: ChatModel
    is_muted: bool


class NotificationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_publication_notifications(
        self,
        *,
        recipient_ids: list[uuid.UUID],
        actor_id: uuid.UUID,
        content_id: uuid.UUID,
        title: str,
        body: str | None,
        metadata: dict[str, Any],
    ) -> list[NotificationModel]:
        if not recipient_ids:
            return []

        stmt = (
            pg_insert(NotificationModel)
            .values(
                [
                    {
                        "recipient_id": recipient_id,
                        "notification_type": NotificationTypeEnum.PUBLICATION,
                        "actor_id": actor_id,
                        "content_id": content_id,
                        "title": title,
                        "body": body,
                        "notification_metadata": metadata,
                    }
                    for recipient_id in recipient_ids
                ]
            )
            .on_conflict_do_nothing(
                index_elements=[NotificationModel.recipient_id, NotificationModel.content_id],
                index_where=(
                    (NotificationModel.notification_type == NotificationTypeEnum.PUBLICATION)
                    & NotificationModel.content_id.is_not(None)
                ),
            )
            .returning(NotificationModel.notification_id)
        )
        result = await self._session.execute(stmt)
        created_ids = list(result.scalars().all())
        await self._session.commit()
        if not created_ids:
            return []

        return await self.get_multi_by_ids(notification_ids=created_ids)

    async def create_messenger_notifications(
        self,
        *,
        recipient_ids: list[uuid.UUID],
        actor_id: uuid.UUID,
        chat_id: uuid.UUID,
        message_id: uuid.UUID,
        title: str,
        body: str | None,
        metadata: dict[str, Any],
    ) -> list[NotificationModel]:
        if not recipient_ids:
            return []

        stmt = (
            pg_insert(NotificationModel)
            .values(
                [
                    {
                        "recipient_id": recipient_id,
                        "notification_type": NotificationTypeEnum.MESSENGER,
                        "actor_id": actor_id,
                        "chat_id": chat_id,
                        "message_id": message_id,
                        "title": title,
                        "body": body,
                        "notification_metadata": metadata,
                    }
                    for recipient_id in recipient_ids
                ]
            )
            .on_conflict_do_nothing(
                index_elements=[NotificationModel.recipient_id, NotificationModel.message_id],
                index_where=(
                    (NotificationModel.notification_type == NotificationTypeEnum.MESSENGER)
                    & NotificationModel.message_id.is_not(None)
                ),
            )
            .returning(NotificationModel.notification_id)
        )
        result = await self._session.execute(stmt)
        created_ids = list(result.scalars().all())
        await self._session.commit()
        if not created_ids:
            return []

        return await self.get_multi_by_ids(notification_ids=created_ids)

    async def get_publication_recipient_ids(
        self,
        *,
        author_id: uuid.UUID,
    ) -> list[uuid.UUID]:
        stmt = (
            select(SubscriptionModel.subscriber_id)
            .where(SubscriptionModel.subscribed_id == author_id)
            .where(SubscriptionModel.subscriber_id != author_id)
            .where(SubscriptionModel.is_muted.is_(False))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_messenger_recipient_ids(
        self,
        *,
        chat_id: uuid.UUID,
        sender_id: uuid.UUID,
    ) -> list[uuid.UUID]:
        stmt = (
            select(MembershipModel.user_id)
            .where(MembershipModel.chat_id == chat_id)
            .where(MembershipModel.user_id != sender_id)
            .where(MembershipModel.is_muted.is_(False))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_multi_by_ids(
        self,
        *,
        notification_ids: list[uuid.UUID],
    ) -> list[NotificationModel]:
        if not notification_ids:
            return []

        stmt = (
            select(NotificationModel)
            .where(NotificationModel.notification_id.in_(notification_ids))
            .options(selectinload(NotificationModel.actor))
            .order_by(desc(NotificationModel.created_at), desc(NotificationModel.notification_id))
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_single(
        self,
        *,
        notification_id: uuid.UUID,
        recipient_id: uuid.UUID,
    ) -> NotificationModel | None:
        stmt = (
            select(NotificationModel)
            .where(NotificationModel.notification_id == notification_id)
            .where(NotificationModel.recipient_id == recipient_id)
            .options(selectinload(NotificationModel.actor))
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        *,
        recipient_id: uuid.UUID,
        notification_type: NotificationTypeEnum | None,
        limit: int,
        before: datetime.datetime | None,
    ) -> list[NotificationModel]:
        stmt = (
            select(NotificationModel)
            .where(NotificationModel.recipient_id == recipient_id)
            .options(selectinload(NotificationModel.actor))
            .order_by(desc(NotificationModel.created_at), desc(NotificationModel.notification_id))
            .limit(limit)
        )
        if notification_type is not None:
            stmt = stmt.where(NotificationModel.notification_type == notification_type)
        if before is not None:
            stmt = stmt.where(NotificationModel.created_at < before)

        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_unread_count(self, *, recipient_id: uuid.UUID) -> int:
        stmt = (
            select(func.count(NotificationModel.notification_id))
            .where(NotificationModel.recipient_id == recipient_id)
            .where(NotificationModel.read_at.is_(None))
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def mark_read(
        self,
        *,
        notification_id: uuid.UUID,
        recipient_id: uuid.UUID,
    ) -> NotificationModel | None:
        stmt = (
            update(NotificationModel)
            .where(NotificationModel.notification_id == notification_id)
            .where(NotificationModel.recipient_id == recipient_id)
            .where(NotificationModel.read_at.is_(None))
            .values(read_at=func.now())
            .returning(NotificationModel.notification_id)
        )
        result = await self._session.execute(stmt)
        updated_id = result.scalar_one_or_none()
        await self._session.commit()
        if updated_id is None:
            return await self.get_single(notification_id=notification_id, recipient_id=recipient_id)
        return await self.get_single(notification_id=updated_id, recipient_id=recipient_id)

    async def mark_all_read(self, *, recipient_id: uuid.UUID) -> int:
        stmt = (
            update(NotificationModel)
            .where(NotificationModel.recipient_id == recipient_id)
            .where(NotificationModel.read_at.is_(None))
            .values(read_at=func.now())
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return int(result.rowcount or 0)

    async def get_author_settings(
        self,
        *,
        subscriber_id: uuid.UUID,
    ) -> list[NotificationAuthorSettingRow]:
        stmt = (
            select(UserModel, SubscriptionModel.is_muted)
            .join(SubscriptionModel, SubscriptionModel.subscribed_id == UserModel.user_id)
            .where(SubscriptionModel.subscriber_id == subscriber_id)
            .options(
                selectinload(UserModel.avatar_asset).selectinload(AssetModel.variants),
            )
            .order_by(
                func.coalesce(UserModel.display_name, UserModel.username),
                UserModel.user_id,
            )
        )
        result = await self._session.execute(stmt)
        return [
            NotificationAuthorSettingRow(author=row[0], is_muted=row[1])
            for row in result.all()
        ]

    async def get_author_setting(
        self,
        *,
        subscriber_id: uuid.UUID,
        author_id: uuid.UUID,
    ) -> NotificationAuthorSettingRow | None:
        stmt = (
            select(UserModel, SubscriptionModel.is_muted)
            .join(SubscriptionModel, SubscriptionModel.subscribed_id == UserModel.user_id)
            .where(SubscriptionModel.subscriber_id == subscriber_id)
            .where(SubscriptionModel.subscribed_id == author_id)
            .options(
                selectinload(UserModel.avatar_asset).selectinload(AssetModel.variants),
            )
        )
        result = await self._session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            return None
        return NotificationAuthorSettingRow(author=row[0], is_muted=row[1])

    async def get_chat_settings(
        self,
        *,
        user_id: uuid.UUID,
    ) -> list[NotificationChatSettingRow]:
        stmt = (
            select(ChatModel, MembershipModel.is_muted)
            .join(MembershipModel, MembershipModel.chat_id == ChatModel.chat_id)
            .where(MembershipModel.user_id == user_id)
            .options(
                selectinload(ChatModel.members)
                .selectinload(UserModel.avatar_asset)
                .selectinload(AssetModel.variants),
            )
            .order_by(ChatModel.title, ChatModel.chat_id)
        )
        result = await self._session.execute(stmt)
        return [
            NotificationChatSettingRow(chat=row[0], is_muted=row[1])
            for row in result.all()
        ]

    async def get_chat_setting(
        self,
        *,
        user_id: uuid.UUID,
        chat_id: uuid.UUID,
    ) -> NotificationChatSettingRow | None:
        stmt = (
            select(ChatModel, MembershipModel.is_muted)
            .join(MembershipModel, MembershipModel.chat_id == ChatModel.chat_id)
            .where(MembershipModel.user_id == user_id)
            .where(MembershipModel.chat_id == chat_id)
            .options(
                selectinload(ChatModel.members)
                .selectinload(UserModel.avatar_asset)
                .selectinload(AssetModel.variants),
            )
        )
        result = await self._session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            return None
        return NotificationChatSettingRow(chat=row[0], is_muted=row[1])

    async def update_author_muted(
        self,
        *,
        subscriber_id: uuid.UUID,
        author_id: uuid.UUID,
        is_muted: bool,
    ) -> bool:
        stmt = (
            update(SubscriptionModel)
            .where(SubscriptionModel.subscriber_id == subscriber_id)
            .where(SubscriptionModel.subscribed_id == author_id)
            .values(is_muted=is_muted)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return bool(result.rowcount)

    async def update_chat_muted(
        self,
        *,
        user_id: uuid.UUID,
        chat_id: uuid.UUID,
        is_muted: bool,
    ) -> bool:
        stmt = (
            update(MembershipModel)
            .where(MembershipModel.user_id == user_id)
            .where(MembershipModel.chat_id == chat_id)
            .values(is_muted=is_muted)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return bool(result.rowcount)
