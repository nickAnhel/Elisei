import datetime
import uuid
from typing import Any

from sqlalchemy import and_, delete, desc, exists, func, insert, literal_column, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.assets.models import AssetModel, ContentAssetModel, MessageAssetModel
from src.chats.timeline import create_message_timeline_item, get_message_chat_seq
from src.common.cursor import decode_cursor, encode_cursor, parse_cursor_timestamp, parse_cursor_uuid
from src.common.exceptions import InvalidCursor
from src.content.models import ContentModel
import src.articles.models  # noqa: F401
import src.moments.models  # noqa: F401
import src.posts.models  # noqa: F401
import src.tags.models  # noqa: F401
import src.videos.models  # noqa: F401
from src.content.enums import ReactionTypeEnum
from src.messages.models import MessageModel, MessageReactionModel, MessageSharedContentModel
from src.users.models import SubscriptionModel, UserModel


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _message_load_options(self):
        return [
            selectinload(MessageModel.user)
            .selectinload(UserModel.avatar_asset)
            .selectinload(AssetModel.variants),
            selectinload(MessageModel.reply_to_message).selectinload(MessageModel.user),
            selectinload(MessageModel.reactions),
            self._asset_links_load(),
            *self._shared_content_load(),
        ]

    async def create(
        self,
        data: dict[str, Any],
        asset_ids: list[uuid.UUID] | None = None,
        shared_content_id: uuid.UUID | None = None,
    ) -> MessageModel:
        stmt = (
            insert(MessageModel)
            .values(**data)
            .returning(MessageModel)
            .options(*self._message_load_options())
        )
        result = await self._session.execute(stmt)
        message = result.scalar_one()
        await self._insert_asset_links(message_id=message.message_id, asset_ids=asset_ids or [])
        await self._insert_shared_content(
            message_id=message.message_id,
            content_id=shared_content_id,
        )
        chat_seq = await create_message_timeline_item(
            session=self._session,
            chat_id=message.chat_id,
            message_id=message.message_id,
        )
        await self._session.commit()
        message = await self.get_single(message_id=message.message_id)
        setattr(message, "chat_seq", chat_seq)
        return message

    async def create_idempotent(
        self,
        data: dict[str, Any],
        asset_ids: list[uuid.UUID] | None = None,
        shared_content_id: uuid.UUID | None = None,
    ) -> MessageModel:
        stmt = (
            pg_insert(MessageModel)
            .values(**data)
            .on_conflict_do_nothing(
                constraint="uq_messages_chat_user_client_message_id",
            )
            .returning(MessageModel)
            .options(*self._message_load_options())
        )
        result = await self._session.execute(stmt)
        message = result.scalar_one_or_none()
        if message is None:
            message = await self.get_single(
                chat_id=data["chat_id"],
                user_id=data["user_id"],
                client_message_id=data["client_message_id"],
            )
            chat_seq = await get_message_chat_seq(
                session=self._session,
                message_id=message.message_id,
            )
        else:
            await self._insert_asset_links(message_id=message.message_id, asset_ids=asset_ids or [])
            await self._insert_shared_content(
                message_id=message.message_id,
                content_id=shared_content_id,
            )
            chat_seq = await create_message_timeline_item(
                session=self._session,
                chat_id=message.chat_id,
                message_id=message.message_id,
            )

        await self._session.commit()
        message = await self.get_single(message_id=message.message_id)
        setattr(message, "chat_seq", chat_seq)
        return message

    async def get_single(
        self,
        **filters,
    ) -> MessageModel:
        query = (
            select(MessageModel)
            .filter_by(**filters)
            .execution_options(populate_existing=True)
            .options(*self._message_load_options())
        )

        result = await self._session.execute(query)
        return result.scalar_one()

    async def get_multi(
        self,
        chat_id: uuid.UUID,
        order: str,
        order_desc: bool,
        offset: int,
        limit: int,
        viewer_id: uuid.UUID | None = None,
        cursor: str | None = None,
    ) -> tuple[list[MessageModel], str | None]:
        supports_cursor = order == "created_at" and order_desc
        if cursor is not None and not supports_cursor:
            raise InvalidCursor("Cursor is not supported for this order/order_desc combination")
        order_column = self._resolve_order_column(order)

        subscription_exists = None
        if viewer_id is not None:
            subscription_exists = exists(
                select(1)
                .select_from(SubscriptionModel)
                .where(SubscriptionModel.subscriber_id == viewer_id)
                .where(SubscriptionModel.subscribed_id == MessageModel.user_id)
            )

        query = select(MessageModel)
        if subscription_exists is not None:
            query = select(MessageModel, subscription_exists.label("user_is_subscribed"))

        query = (
            query
            .filter_by(chat_id=chat_id)
            .order_by(
                desc(order_column) if order_desc else order_column,
                desc(MessageModel.message_id),
            )
            .options(*self._message_load_options())
        )

        if cursor is not None:
            cursor_created_at, cursor_message_id = self._decode_messages_cursor(
                token=cursor,
                chat_id=chat_id,
                order=order,
                order_desc=order_desc,
            )
            query = query.where(
                or_(
                    MessageModel.created_at < cursor_created_at,
                    and_(
                        MessageModel.created_at == cursor_created_at,
                        MessageModel.message_id < cursor_message_id,
                    ),
                )
            ).limit(limit + 1)
        else:
            query = query.offset(offset).limit(limit + 1)

        result = await self._session.execute(query)
        if viewer_id is None:
            fetched_desc = list(result.scalars().all())
        else:
            fetched_desc = []
            for message, user_is_subscribed in result.all():
                setattr(message.user, "is_subscribed", bool(user_is_subscribed))
                fetched_desc.append(message)

        page_desc = fetched_desc[:limit]
        has_next = len(fetched_desc) > limit
        next_cursor = None
        if has_next and supports_cursor and page_desc:
            next_cursor = self._encode_messages_cursor(
                chat_id=chat_id,
                order=order,
                order_desc=order_desc,
                message=page_desc[-1],
            )
        return list(reversed(page_desc)), next_cursor

    async def delete(self, **filters) -> int:
        stmt = (
            update(MessageModel)
            .values(deleted_at=func.now(), deleted_by=filters.get("user_id"))
            .filter_by(**filters)
            .where(MessageModel.deleted_at.is_(None))
        )

        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount

    async def soft_delete(
        self,
        *,
        message_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> MessageModel:
        stmt = (
            update(MessageModel)
            .values(deleted_at=func.now(), deleted_by=user_id)
            .filter_by(message_id=message_id, user_id=user_id)
            .where(MessageModel.deleted_at.is_(None))
            .returning(MessageModel)
            .options(*self._message_load_options())
        )

        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.scalar_one()

    async def delete_multi(
        self,
        chat_id: uuid.UUID,
    ) -> int:
        stmt = (
            update(MessageModel)
            .values(deleted_at=func.now())
            .filter_by(chat_id=chat_id)
            .where(MessageModel.deleted_at.is_(None))
        )

        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount

    async def update(
        self,
        data: dict[str, Any],
        **filters,
    ) -> MessageModel:
        stmt = (
            update(MessageModel)
            .values(**data, edited_at=func.now())
            .filter_by(**filters)
            .where(MessageModel.deleted_at.is_(None))
            .returning(MessageModel)
            .options(*self._message_load_options())
        )

        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.scalar_one()

    async def search(
        self,
        query_text: str,
        order: str,
        order_desc: bool,
        offset: int,
        limit: int,
        **filters,
    ) -> tuple[list[MessageModel], int]:
        search_vector = func.to_tsvector(
            literal_column("'simple'"),
            func.coalesce(MessageModel.content, literal_column("''")),
        )
        search_query = func.websearch_to_tsquery(literal_column("'simple'"), query_text)
        where_clauses = (
            MessageModel.deleted_at.is_(None),
            search_vector.op("@@")(search_query),
        )
        query = (
            select(MessageModel)
            .filter_by(**filters)
            .where(*where_clauses)
            .order_by(
                desc(MessageModel.created_at),
                desc(MessageModel.message_id),
            )
            .offset(offset)
            .limit(limit)
            .options(*self._message_load_options())
        )
        count_query = (
            select(func.count())
            .select_from(MessageModel)
            .filter_by(**filters)
            .where(*where_clauses)
        )

        result = await self._session.execute(query)
        count_result = await self._session.execute(count_query)
        return list(result.scalars().all()), int(count_result.scalar_one())

    async def get_reply_target(
        self,
        *,
        message_id: uuid.UUID,
    ) -> MessageModel:
        query = (
            select(MessageModel)
            .filter_by(message_id=message_id)
            .options(selectinload(MessageModel.user))
        )

        result = await self._session.execute(query)
        return result.scalar_one()

    async def set_reaction(
        self,
        *,
        message_id: uuid.UUID,
        user_id: uuid.UUID,
        reaction_type: ReactionTypeEnum,
    ) -> MessageModel:
        existing = await self._session.execute(
            select(MessageReactionModel)
            .where(MessageReactionModel.message_id == message_id)
            .where(MessageReactionModel.user_id == user_id)
        )
        current_reaction = existing.scalar_one_or_none()
        if current_reaction is None:
            await self._session.execute(
                insert(MessageReactionModel).values(
                    message_id=message_id,
                    user_id=user_id,
                    reaction_type=reaction_type,
                )
            )
        elif current_reaction.reaction_type != reaction_type:
            await self._session.execute(
                update(MessageReactionModel)
                .where(MessageReactionModel.message_id == message_id)
                .where(MessageReactionModel.user_id == user_id)
                .values(reaction_type=reaction_type)
            )

        await self._session.commit()
        return await self.get_single(message_id=message_id)

    async def remove_reaction(
        self,
        *,
        message_id: uuid.UUID,
        user_id: uuid.UUID,
        reaction_type: ReactionTypeEnum,
    ) -> MessageModel:
        existing = await self._session.execute(
            select(MessageReactionModel)
            .where(MessageReactionModel.message_id == message_id)
            .where(MessageReactionModel.user_id == user_id)
        )
        current_reaction = existing.scalar_one_or_none()
        if current_reaction is None or current_reaction.reaction_type != reaction_type:
            return await self.get_single(message_id=message_id)

        await self._session.execute(
            delete(MessageReactionModel)
            .where(MessageReactionModel.message_id == message_id)
            .where(MessageReactionModel.user_id == user_id)
        )
        await self._session.commit()
        return await self.get_single(message_id=message_id)

    async def _insert_asset_links(
        self,
        *,
        message_id: uuid.UUID,
        asset_ids: list[uuid.UUID],
    ) -> None:
        if not asset_ids:
            return

        await self._session.execute(
            insert(MessageAssetModel).values(
                [
                    {
                        "message_id": message_id,
                        "asset_id": asset_id,
                        "sort_order": position,
                    }
                    for position, asset_id in enumerate(asset_ids)
                ]
            )
        )

    async def _insert_shared_content(
        self,
        *,
        message_id: uuid.UUID,
        content_id: uuid.UUID | None,
    ) -> None:
        if content_id is None:
            return

        await self._session.execute(
            insert(MessageSharedContentModel).values(
                message_id=message_id,
                content_id=content_id,
            )
        )

    def _asset_links_load(self):
        return (
            selectinload(MessageModel.asset_links)
            .selectinload(MessageAssetModel.asset)
            .selectinload(AssetModel.variants)
        )

    def _shared_content_load(self):
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

    def _decode_messages_cursor(
        self,
        *,
        token: str,
        chat_id: uuid.UUID,
        order: str,
        order_desc: bool,
    ) -> tuple[datetime.datetime, uuid.UUID]:
        payload = decode_cursor(token)
        if payload.get("kind") != "messages:list":
            raise InvalidCursor("Cursor kind mismatch for messages list")
        if payload.get("endpoint") != "/messages/":
            raise InvalidCursor("Cursor endpoint mismatch")
        if payload.get("chat_id") != str(chat_id):
            raise InvalidCursor("Cursor chat mismatch")
        if payload.get("order") != order or payload.get("order_desc") is not order_desc:
            raise InvalidCursor("Cursor order mismatch")
        if payload.get("sort_field") != "created_at":
            raise InvalidCursor("Cursor sort field mismatch")
        created_at = parse_cursor_timestamp(payload.get("timestamp"), field_name="timestamp")
        message_id = parse_cursor_uuid(payload.get("message_id"), field_name="message_id")
        return created_at, message_id

    def _encode_messages_cursor(
        self,
        *,
        chat_id: uuid.UUID,
        order: str,
        order_desc: bool,
        message: MessageModel,
    ) -> str:
        return encode_cursor(
            {
                "kind": "messages:list",
                "endpoint": "/messages/",
                "chat_id": str(chat_id),
                "order": order,
                "order_desc": order_desc,
                "sort_field": "created_at",
                "timestamp": message.created_at.isoformat(),
                "message_id": str(message.message_id),
            }
        )

    def _resolve_order_column(self, order: str):
        if order == "created_at":
            return MessageModel.created_at
        if order == "message_id":
            return MessageModel.message_id
        raise InvalidCursor("Unsupported messages order field")
