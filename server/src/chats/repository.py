import datetime
import uuid
from typing import Any

from sqlalchemy import and_, delete, desc, func, insert, literal, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from src.assets.models import AssetModel, ContentAssetModel, MessageAssetModel
from src.chats.enums import ChatMemberRole, ChatType
from src.chats.models import ChatModel, ChatTimelineItemModel, MembershipModel
from src.common.cursor import decode_cursor, encode_cursor, parse_cursor_timestamp, parse_cursor_uuid
from src.common.exceptions import InvalidCursor
from src.content.models import ContentModel
import src.articles.models  # noqa: F401
import src.moments.models  # noqa: F401
import src.posts.models  # noqa: F401
import src.tags.models  # noqa: F401
import src.videos.models  # noqa: F401
from src.events.models import EventModel
from src.messages.models import MessageModel, MessageSharedContentModel
from src.users.models import UserModel


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        data: dict[str, Any],
    ) -> ChatModel:
        stmt = (
            insert(ChatModel)
            .values(**data)
            .returning(ChatModel)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.scalar_one()

    async def create_with_member_roles(
        self,
        *,
        data: dict[str, Any],
        member_roles: list[tuple[uuid.UUID, ChatMemberRole]],
    ) -> ChatModel:
        try:
            chat_result = await self._session.execute(
                insert(ChatModel)
                .values(**data)
                .returning(ChatModel)
            )
            chat = chat_result.scalar_one()

            if member_roles:
                await self._session.execute(
                    insert(MembershipModel).values(
                        [
                            {
                                "chat_id": chat.chat_id,
                                "user_id": user_id,
                                "role": role.value,
                            }
                            for user_id, role in member_roles
                        ]
                    )
                )

            await self._session.commit()
            return chat
        except Exception:
            await self._session.rollback()
            raise

    async def get_single(
        self,
        **filters,
    ) -> ChatModel:
        query = (
            select(ChatModel)
            .filter_by(**filters)
            .options(*self._chat_load_options())
        )

        result = await self._session.execute(query)
        return result.scalar_one()

    async def get_by_direct_key(
        self,
        direct_key: str,
    ) -> ChatModel | None:
        query = (
            select(ChatModel)
            .filter_by(chat_type=ChatType.DIRECT.value, direct_key=direct_key)
            .options(*self._chat_load_options())
        )

        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def history(
        self,
        *,
        chat_id: uuid.UUID,
        limit: int,
        before_seq: int | None = None,
        after_seq: int | None = None,
    ) -> list[tuple[ChatTimelineItemModel, MessageModel | EventModel]]:
        query = (
            select(ChatTimelineItemModel)
            .where(ChatTimelineItemModel.chat_id == chat_id)
            .limit(limit)
        )

        if before_seq is not None:
            query = (
                query
                .where(ChatTimelineItemModel.chat_seq < before_seq)
                .order_by(ChatTimelineItemModel.chat_seq.desc())
            )
        elif after_seq is not None:
            query = (
                query
                .where(ChatTimelineItemModel.chat_seq > after_seq)
                .order_by(ChatTimelineItemModel.chat_seq.asc())
            )
        else:
            query = query.order_by(ChatTimelineItemModel.chat_seq.desc())

        timeline_items = list((await self._session.execute(query)).scalars().all())
        if after_seq is None:
            timeline_items.reverse()

        message_ids = [
            item.message_id
            for item in timeline_items
            if item.item_type == "message" and item.message_id is not None
        ]
        event_ids = [
            item.event_id
            for item in timeline_items
            if item.item_type == "event" and item.event_id is not None
        ]

        messages_by_id: dict[uuid.UUID, MessageModel] = {}
        if message_ids:
            messages_query = (
                select(MessageModel)
                .where(MessageModel.message_id.in_(message_ids))
                .options(
                    selectinload(MessageModel.user)
                    .selectinload(UserModel.avatar_asset)
                    .selectinload(AssetModel.variants),
                    selectinload(MessageModel.reply_to_message).selectinload(MessageModel.user),
                    selectinload(MessageModel.reactions),
                    self._message_asset_links_load(),
                    *self._message_shared_content_load(),
                )
            )
            messages = (await self._session.execute(messages_query)).scalars().all()
            messages_by_id = {message.message_id: message for message in messages}

        events_by_id: dict[uuid.UUID, EventModel] = {}
        if event_ids:
            events_query = (
                select(EventModel)
                .where(EventModel.event_id.in_(event_ids))
                .options(
                    selectinload(EventModel.user)
                    .selectinload(UserModel.avatar_asset)
                    .selectinload(AssetModel.variants),
                    selectinload(EventModel.altered_user)
                    .selectinload(UserModel.avatar_asset)
                    .selectinload(AssetModel.variants),
                )
            )
            events = (await self._session.execute(events_query)).scalars().all()
            events_by_id = {event.event_id: event for event in events}

        history: list[tuple[ChatTimelineItemModel, MessageModel | EventModel]] = []
        for timeline_item in timeline_items:
            if timeline_item.item_type == "message" and timeline_item.message_id is not None:
                item = messages_by_id.get(timeline_item.message_id)
            elif timeline_item.item_type == "event" and timeline_item.event_id is not None:
                item = events_by_id.get(timeline_item.event_id)
            else:
                item = None

            if item is None:
                continue

            setattr(item, "chat_seq", timeline_item.chat_seq)
            history.append((timeline_item, item))

        return history

    async def get_members(
        self,
        chat_id: uuid.UUID,
    ) -> list[UserModel]:
        query = (
            select(UserModel)
            .join(MembershipModel, MembershipModel.user_id == UserModel.user_id)
            .where(MembershipModel.chat_id == chat_id)
            .options(
                selectinload(UserModel.avatar_asset)
                .selectinload(AssetModel.variants)
            )
        )

        result = await self._session.execute(query)
        members = list(result.scalars().all())
        if not members:
            await self.get_single(chat_id=chat_id)
        return members

    async def is_member(
        self,
        *,
        chat_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        query = (
            select(MembershipModel.user_id)
            .filter_by(chat_id=chat_id, user_id=user_id)
            .limit(1)
        )

        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def get_joined_chat_ids(
        self,
        *,
        user_id: uuid.UUID,
        chat_ids: list[uuid.UUID],
    ) -> set[uuid.UUID]:
        if not chat_ids:
            return set()

        query = (
            select(MembershipModel.chat_id)
            .where(MembershipModel.user_id == user_id)
            .where(MembershipModel.chat_id.in_(chat_ids))
        )
        result = await self._session.execute(query)
        return set(result.scalars().all())

    async def is_owner_member(
        self,
        *,
        chat_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        query = (
            select(MembershipModel.user_id)
            .filter_by(
                chat_id=chat_id,
                user_id=user_id,
                role=ChatMemberRole.OWNER.value,
            )
            .limit(1)
        )

        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def get_multi(
        self,
        *,
        order: str,
        order_desc: bool,
        offset: int,
        limit: int,
    ) -> list[ChatModel]:
        query = (
            select(ChatModel)
            .filter_by(is_private=False, chat_type=ChatType.GROUP.value)
            .options(*self._chat_load_options())
            .order_by(desc(order) if order_desc else order)
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def add_members(
        self,
        chat_id: uuid.UUID,
        users_ids: list[uuid.UUID],
        role: ChatMemberRole = ChatMemberRole.MEMBER,
    ) -> int:
        users_query = (
            select(literal(chat_id), UserModel.user_id, literal(role.value))
            .where(
                UserModel.user_id.in_([user_id for user_id in users_ids]),
            )
        )

        stmt = (
            insert(MembershipModel)
            .from_select(
                ["chat_id", "user_id", "role"],
                users_query,
            )
        )

        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount

    async def remove_members(
        self,
        chat_id: uuid.UUID,
        members_ids: list[uuid.UUID],
    ) -> int:
        stmt = (
            delete(MembershipModel)
            .filter_by(chat_id=chat_id)
            .where(MembershipModel.user_id.in_(members_ids))
        )

        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount

    async def update(
        self,
        chat_id: uuid.UUID,
        data: dict[str, Any],
    ) -> ChatModel:
        await self._session.execute(
            update(ChatModel)
            .values(**data)
            .filter_by(chat_id=chat_id)
        )
        await self._session.commit()
        return await self.get_single(chat_id=chat_id)

    async def delete(
        self,
        chat_id: uuid.UUID,
    ) -> int:
        stmt = (
            delete(ChatModel)
            .filter_by(chat_id=chat_id)
        )

        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount

    async def search(
        self,
        *,
        user_id: uuid.UUID,
        q: str,
        offset: int,
        limit: int,
    ) -> list[ChatModel]:
        subquery = (
            select(ChatModel.chat_id)
            .where(
                ChatModel.title.bool_op("%")(q),
                ChatModel.chat_type == ChatType.GROUP.value,
                or_(
                    ChatModel.is_private == False,
                    ChatModel.members.contains(UserModel(user_id=user_id)),
                ),
            )
            .distinct()
            .subquery()
        )

        query = (
            select(ChatModel)
            .join(subquery, ChatModel.chat_id == subquery.c.chat_id)
            .options(*self._chat_load_options())
            .order_by(
                func.similarity(ChatModel.title, q).desc(),
            )
            .offset(offset)
            .limit(limit)
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())


    async def get_user_joined_chats(
        self,
        user_id: uuid.UUID,
        order: str,
        order_desc: bool,
        offset: int,
        limit: int,
    ) -> list[ChatModel]:
        chat_ids_query = (
            select(MembershipModel.chat_id)
            .filter_by(user_id=user_id)
            .cte()
        )

        query = (
            select(ChatModel)
            .where(ChatModel.chat_id.in_(chat_ids_query))
            .options(*self._chat_load_options())
            .order_by(desc(order) if order_desc else order)
            .offset(offset)
            .limit(limit)
        )

        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_user_dialogs(
        self,
        *,
        user_id: uuid.UUID,
        offset: int,
        limit: int,
        cursor: str | None = None,
        order: str | None = None,
        order_desc: bool | None = None,
    ) -> tuple[list[ChatModel], str | None]:
        if cursor is not None and ((order is not None and order != "chat_id") or (order_desc is not None and order_desc)):
            raise InvalidCursor("Cursor is not supported for this order/order_desc combination")

        latest_message_at_query = (
            select(
                MessageModel.chat_id,
                func.max(MessageModel.created_at).label("last_message_at"),
            )
            .group_by(MessageModel.chat_id)
            .subquery()
        )

        query = (
            select(ChatModel, MembershipModel, latest_message_at_query.c.last_message_at)
            .join(
                MembershipModel,
                MembershipModel.chat_id == ChatModel.chat_id,
            )
            .outerjoin(
                latest_message_at_query,
                latest_message_at_query.c.chat_id == ChatModel.chat_id,
            )
            .where(MembershipModel.user_id == user_id)
            .options(*self._chat_load_options())
            .order_by(
                desc(latest_message_at_query.c.last_message_at).nulls_last(),
                ChatModel.chat_id,
            )
        )
        if cursor is not None:
            cursor_last_message_at, cursor_chat_id = self._decode_user_dialogs_cursor(
                token=cursor,
                user_id=user_id,
            )
            query = query.where(
                or_(
                    latest_message_at_query.c.last_message_at < cursor_last_message_at,
                    and_(
                        latest_message_at_query.c.last_message_at == cursor_last_message_at,
                        ChatModel.chat_id > cursor_chat_id,
                    ),
                )
            ).limit(limit + 1)
        else:
            query = query.offset(offset).limit(limit + 1)

        rows = (await self._session.execute(query)).unique().all()
        page_rows = rows[:limit]
        chats = [row[0] for row in page_rows]
        memberships_by_chat_id = {row[0].chat_id: row[1] for row in page_rows}
        last_message_at_by_chat_id = {row[0].chat_id: row[2] for row in page_rows}

        chat_ids = [chat.chat_id for chat in chats]
        last_messages = await self._get_last_messages(chat_ids=chat_ids)
        unread_counts = await self._get_unread_counts(
            chat_ids=chat_ids,
            memberships_by_chat_id=memberships_by_chat_id,
            user_id=user_id,
        )

        for chat in chats:
            membership = memberships_by_chat_id[chat.chat_id]
            setattr(chat, "membership", membership)
            setattr(chat, "last_message", last_messages.get(chat.chat_id))
            setattr(chat, "last_message_at", last_message_at_by_chat_id[chat.chat_id])
            setattr(chat, "unread_count", unread_counts.get(chat.chat_id, 0))

        next_cursor = None
        has_next = len(rows) > limit
        if has_next and chats:
            next_cursor = self._encode_user_dialogs_cursor(
                user_id=user_id,
                chat=chats[-1],
                last_message_at=last_message_at_by_chat_id.get(chats[-1].chat_id),
            )
        return chats, next_cursor

    async def set_avatar(
        self,
        *,
        chat_id: uuid.UUID,
        avatar_asset_id: uuid.UUID,
        avatar_crop: dict[str, Any],
    ) -> ChatModel:
        await self._session.execute(
            update(ChatModel)
            .where(ChatModel.chat_id == chat_id)
            .values(
                avatar_asset_id=avatar_asset_id,
                avatar_crop=avatar_crop,
            )
        )
        await self._session.commit()
        return await self.get_single(chat_id=chat_id)

    async def clear_avatar(
        self,
        *,
        chat_id: uuid.UUID,
    ) -> ChatModel:
        await self._session.execute(
            update(ChatModel)
            .where(ChatModel.chat_id == chat_id)
            .values(
                avatar_asset_id=None,
                avatar_crop=None,
            )
        )
        await self._session.commit()
        return await self.get_single(chat_id=chat_id)

    async def mark_read(
        self,
        *,
        chat_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> uuid.UUID | None:
        latest_message_id = await self.get_latest_message_id(chat_id=chat_id)
        stmt = (
            update(MembershipModel)
            .values(last_read_message_id=latest_message_id)
            .filter_by(chat_id=chat_id, user_id=user_id)
        )

        await self._session.execute(stmt)
        await self._session.commit()
        return latest_message_id

    async def get_latest_message_id(
        self,
        *,
        chat_id: uuid.UUID,
    ) -> uuid.UUID | None:
        query = (
            select(MessageModel.message_id)
            .filter_by(chat_id=chat_id)
            .order_by(desc(MessageModel.created_at), desc(MessageModel.message_id))
            .limit(1)
        )

        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def _get_last_messages(
        self,
        *,
        chat_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, MessageModel]:
        if not chat_ids:
            return {}

        ranked_messages = (
            select(
                MessageModel.message_id,
                func.row_number()
                .over(
                    partition_by=MessageModel.chat_id,
                    order_by=[
                        desc(MessageModel.created_at),
                        desc(MessageModel.message_id),
                    ],
                )
                .label("rank"),
            )
            .where(MessageModel.chat_id.in_(chat_ids))
            .subquery()
        )

        query = (
            select(MessageModel)
            .join(
                ranked_messages,
                MessageModel.message_id == ranked_messages.c.message_id,
            )
            .where(ranked_messages.c.rank == 1)
            .options(
                selectinload(MessageModel.user)
                .selectinload(UserModel.avatar_asset)
                .selectinload(AssetModel.variants),
                selectinload(MessageModel.reply_to_message).selectinload(MessageModel.user),
                selectinload(MessageModel.reactions),
                self._message_asset_links_load(),
                *self._message_shared_content_load(),
            )
        )

        result = await self._session.execute(query)
        return {message.chat_id: message for message in result.scalars().all()}

    async def _get_unread_counts(
        self,
        *,
        chat_ids: list[uuid.UUID],
        memberships_by_chat_id: dict[uuid.UUID, MembershipModel],
        user_id: uuid.UUID,
    ) -> dict[uuid.UUID, int]:
        if not chat_ids:
            return {}

        read_message = aliased(MessageModel)
        query = (
            select(MessageModel.chat_id, func.count(MessageModel.message_id))
            .join(
                MembershipModel,
                MembershipModel.chat_id == MessageModel.chat_id,
            )
            .outerjoin(
                read_message,
                read_message.message_id == MembershipModel.last_read_message_id,
            )
            .where(
                MessageModel.chat_id.in_(chat_ids),
                MembershipModel.user_id == user_id,
                MessageModel.user_id != user_id,
                or_(
                    MembershipModel.last_read_message_id.is_(None),
                    MessageModel.created_at > read_message.created_at,
                    (
                        (MessageModel.created_at == read_message.created_at)
                        & (MessageModel.message_id > read_message.message_id)
                    ),
                ),
            )
            .group_by(MessageModel.chat_id)
        )

        result = await self._session.execute(query)
        counts = {chat_id: count for chat_id, count in result.all()}
        for chat_id in memberships_by_chat_id:
            counts.setdefault(chat_id, 0)
        return counts

    def _members_load(self):
        return (
            selectinload(ChatModel.members)
            .selectinload(UserModel.avatar_asset)
            .selectinload(AssetModel.variants)
        )

    def _chat_avatar_load(self):
        return (
            selectinload(ChatModel.avatar_asset)
            .selectinload(AssetModel.variants)
        )

    def _chat_load_options(self):
        return (
            self._members_load(),
            self._chat_avatar_load(),
        )

    def _message_asset_links_load(self):
        return (
            selectinload(MessageModel.asset_links)
            .selectinload(MessageAssetModel.asset)
            .selectinload(AssetModel.variants)
        )

    def _message_shared_content_load(self):
        content_load = selectinload(MessageModel.shared_content).selectinload(
            MessageSharedContentModel.content
        )
        return (
            content_load.selectinload(ContentModel.author)
            .selectinload(UserModel.avatar_asset)
            .selectinload(AssetModel.variants),
            content_load.selectinload(ContentModel.post_details),
            content_load.selectinload(ContentModel.article_details),
            content_load.selectinload(ContentModel.video_details),
            content_load.selectinload(ContentModel.moment_details),
            content_load.selectinload(ContentModel.video_playback_details),
            content_load.selectinload(ContentModel.tags),
            content_load.selectinload(ContentModel.asset_links)
            .selectinload(ContentAssetModel.asset)
            .selectinload(AssetModel.variants),
        )

    def _decode_user_dialogs_cursor(
        self,
        *,
        token: str,
        user_id: uuid.UUID,
    ) -> tuple[datetime.datetime, uuid.UUID]:
        payload = decode_cursor(token)
        if payload.get("kind") != "chats:user":
            raise InvalidCursor("Cursor kind mismatch for user chats")
        if payload.get("endpoint") != "/chats/user":
            raise InvalidCursor("Cursor endpoint mismatch")
        if payload.get("user_id") != str(user_id):
            raise InvalidCursor("Cursor user mismatch")
        if payload.get("order") != "chat_id" or payload.get("order_desc") is not False:
            raise InvalidCursor("Cursor order mismatch")
        if payload.get("sort_field") != "last_message_at":
            raise InvalidCursor("Cursor sort field mismatch")
        last_message_at = parse_cursor_timestamp(payload.get("timestamp"), field_name="timestamp")
        chat_id = parse_cursor_uuid(payload.get("chat_id"), field_name="chat_id")
        return last_message_at, chat_id

    def _encode_user_dialogs_cursor(
        self,
        *,
        user_id: uuid.UUID,
        chat: ChatModel,
        last_message_at: datetime.datetime | None,
    ) -> str | None:
        if last_message_at is None:
            return None
        return encode_cursor(
            {
                "kind": "chats:user",
                "endpoint": "/chats/user",
                "user_id": str(user_id),
                "order": "chat_id",
                "order_desc": False,
                "sort_field": "last_message_at",
                "timestamp": last_message_at.isoformat(),
                "chat_id": str(chat.chat_id),
            }
        )
