from __future__ import annotations

import datetime
import uuid
from typing import Iterable
from urllib.parse import parse_qsl

from sqlalchemy import and_, delete, inspect as sa_inspect, or_, select
from sqladmin import ModelView, action
from sqladmin.helpers import object_identifier_values
from starlette.datastructures import URL, MultiDict
from starlette.requests import Request
from starlette.responses import RedirectResponse

from src.admin.models import SessionModel
from src.assets.enums import AssetStatusEnum
from src.assets.models import AssetModel, AssetVariantModel, ContentAssetModel
from src.chats.models import ChatModel  # noqa: F401
from src.comments.models import CommentModel, CommentReactionModel
from src.common.database import async_session_maker
from src.content.enums import ContentStatusEnum, ContentVisibilityEnum
from src.content.models import ContentModel, ContentReactionModel
from src.events.models import EventModel  # noqa: F401
from src.messages.models import MessageModel, MessageReactionModel  # noqa: F401
from src.moments.models import MomentDetailsModel  # noqa: F401
from src.posts.models import PostDetailsModel  # noqa: F401
from src.tags.models import ContentTagModel, TagModel
from src.articles.models import ArticleDetailsModel  # noqa: F401
from src.videos.models import VideoDetailsModel, VideoPlaybackDetailsModel  # noqa: F401
from src.users.models import SubscriptionModel, UserModel


class OperationalModelView(ModelView):
    page_size = 50
    page_size_options = [25, 50, 100]

    @staticmethod
    def _parse_selected_pks(request: Request) -> list[str]:
        raw_pks = request.query_params.get("pks", "")
        return [pk for pk in raw_pks.split(",") if pk]

    @staticmethod
    def _coerce_pk_value(raw_value: str, column) -> object:  # type: ignore[no-untyped-def]
        if raw_value is None:
            return raw_value

        try:
            python_type = column.type.python_type
        except (AttributeError, NotImplementedError):
            return raw_value

        if python_type is uuid.UUID:
            return uuid.UUID(str(raw_value))

        try:
            return python_type(raw_value)
        except (TypeError, ValueError):
            return raw_value

    @classmethod
    def _build_pk_filters(cls, pks: Iterable[str], model):  # type: ignore[no-untyped-def]
        mapper = sa_inspect(model)
        pk_columns = list(mapper.primary_key)
        filters = []

        for pk in pks:
            values = object_identifier_values(pk, model)
            if len(values) != len(pk_columns):
                continue

            conditions = [
                column == cls._coerce_pk_value(raw_value, column)
                for column, raw_value in zip(pk_columns, values)
            ]
            filters.append(and_(*conditions))

        return filters

    @staticmethod
    def _build_list_redirect(request: Request, identity: str) -> RedirectResponse:
        referer_url = URL(request.headers.get("referer", ""))
        referer_params = MultiDict(parse_qsl(referer_url.query))
        url = URL(str(request.url_for("admin:list", identity=identity))).include_query_params(
            **referer_params
        )
        return RedirectResponse(str(url), status_code=302)


class UserAdminView(OperationalModelView, model=UserModel):
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"
    category = "Users"
    category_icon = "fa-solid fa-users"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = [
        "user_id",
        "username",
        "display_name",
        "is_admin",
        "subscribers_count",
        "avatar_asset_id",
        "created_at",
    ]
    column_details_list = [
        "user_id",
        "username",
        "display_name",
        "bio",
        "links",
        "avatar_asset_id",
        "avatar_crop",
        "is_admin",
        "subscribers_count",
        "created_at",
    ]
    column_searchable_list = ["user_id", "username", "display_name"]
    column_sortable_list = ["user_id", "username", "is_admin", "subscribers_count", "created_at"]
    column_default_sort = [("created_at", True)]
    column_export_exclude_list = ["hashed_password"]
    form_excluded_columns = ["hashed_password"]
    column_filters = ["is_admin", "created_at"]

    @action(
        name="grant_admin",
        label="Grant admin",
        confirmation_message="Grant admin role to selected users?",
    )
    async def grant_admin(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, UserModel)
            if filters:
                async with async_session_maker() as session:
                    stmt = select(UserModel).where(or_(*filters))
                    users = (await session.execute(stmt)).scalars().all()
                    for user in users:
                        user.is_admin = True
                    await session.commit()

        return self._build_list_redirect(request, self.identity)

    @action(
        name="revoke_admin",
        label="Revoke admin",
        confirmation_message="Revoke admin role from selected users?",
    )
    async def revoke_admin(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, UserModel)
            if filters:
                async with async_session_maker() as session:
                    stmt = select(UserModel).where(or_(*filters))
                    users = (await session.execute(stmt)).scalars().all()
                    for user in users:
                        user.is_admin = False
                    await session.commit()

        return self._build_list_redirect(request, self.identity)


class SubscriptionAdminView(OperationalModelView, model=SubscriptionModel):
    name = "Subscription"
    name_plural = "Subscriptions"
    icon = "fa-solid fa-user-plus"
    category = "Users"
    category_icon = "fa-solid fa-users"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = ["subscriber_id", "subscribed_id", "is_muted"]
    column_details_list = ["subscriber_id", "subscribed_id", "is_muted"]
    column_searchable_list = ["subscriber_id", "subscribed_id"]
    column_sortable_list = ["subscriber_id", "subscribed_id", "is_muted"]
    column_default_sort = [("subscriber_id", False)]
    column_filters = ["is_muted"]


class ContentAdminView(OperationalModelView, model=ContentModel):
    name = "Content"
    name_plural = "Content"
    icon = "fa-solid fa-newspaper"
    category = "Content"
    category_icon = "fa-solid fa-file-lines"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = [
        "content_id",
        "author_id",
        "content_type",
        "status",
        "visibility",
        "title",
        "content_summary_ellipsis",
        "comments_count",
        "likes_count",
        "dislikes_count",
        "views_count",
        "published_at",
        "created_at",
        "deleted_at",
    ]
    column_details_list = [
        "content_id",
        "author_id",
        "content_type",
        "status",
        "visibility",
        "title",
        "excerpt",
        "content_metadata",
        "comments_count",
        "likes_count",
        "dislikes_count",
        "views_count",
        "published_at",
        "created_at",
        "updated_at",
        "deleted_at",
    ]
    column_searchable_list = ["content_id", "author_id", "title", "excerpt"]
    column_sortable_list = [
        "content_id",
        "author_id",
        "content_type",
        "status",
        "visibility",
        "published_at",
        "created_at",
        "updated_at",
        "deleted_at",
    ]
    column_default_sort = [("created_at", True)]
    column_filters = ["content_type", "status", "visibility", "created_at", "published_at", "deleted_at"]

    @action(
        name="publish",
        label="Publish",
        confirmation_message="Publish selected content items?",
    )
    async def publish(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, ContentModel)
            if filters:
                now = datetime.datetime.now(datetime.timezone.utc)
                async with async_session_maker() as session:
                    stmt = select(ContentModel).where(or_(*filters))
                    items = (await session.execute(stmt)).scalars().all()
                    for item in items:
                        if item.deleted_at is not None:
                            continue
                        item.status = ContentStatusEnum.PUBLISHED
                        item.published_at = now
                        item.updated_at = now
                    await session.commit()

        return self._build_list_redirect(request, self.identity)

    @action(
        name="hide_unpublish",
        label="Hide / Unpublish",
        confirmation_message="Move selected content back to draft?",
    )
    async def hide_unpublish(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, ContentModel)
            if filters:
                now = datetime.datetime.now(datetime.timezone.utc)
                async with async_session_maker() as session:
                    stmt = select(ContentModel).where(or_(*filters))
                    items = (await session.execute(stmt)).scalars().all()
                    for item in items:
                        if item.deleted_at is not None:
                            continue
                        item.status = ContentStatusEnum.DRAFT
                        item.published_at = None
                        item.updated_at = now
                    await session.commit()

        return self._build_list_redirect(request, self.identity)

    @action(
        name="make_private",
        label="Make private",
        confirmation_message="Set visibility=private for selected content?",
    )
    async def make_private(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, ContentModel)
            if filters:
                now = datetime.datetime.now(datetime.timezone.utc)
                async with async_session_maker() as session:
                    stmt = select(ContentModel).where(or_(*filters))
                    items = (await session.execute(stmt)).scalars().all()
                    for item in items:
                        if item.deleted_at is not None:
                            continue
                        item.visibility = ContentVisibilityEnum.PRIVATE
                        item.updated_at = now
                    await session.commit()

        return self._build_list_redirect(request, self.identity)


class CommentAdminView(OperationalModelView, model=CommentModel):
    name = "Comment"
    name_plural = "Comments"
    icon = "fa-solid fa-comment"
    category = "Moderation"
    category_icon = "fa-solid fa-shield"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = [
        "comment_id",
        "content_id",
        "author_id",
        "parent_comment_id",
        "depth",
        "body_text",
        "likes_count",
        "dislikes_count",
        "replies_count",
        "created_at",
        "deleted_at",
    ]
    column_details_list = [
        "comment_id",
        "content_id",
        "author_id",
        "parent_comment_id",
        "root_comment_id",
        "reply_to_comment_id",
        "depth",
        "body_text",
        "likes_count",
        "dislikes_count",
        "replies_count",
        "created_at",
        "updated_at",
        "deleted_at",
    ]
    column_searchable_list = ["comment_id", "content_id", "author_id", "body_text"]
    column_sortable_list = [
        "comment_id",
        "content_id",
        "author_id",
        "depth",
        "created_at",
        "updated_at",
        "deleted_at",
    ]
    column_default_sort = [("created_at", True)]
    column_filters = ["depth", "created_at", "deleted_at"]

    @action(
        name="soft_delete",
        label="Soft delete",
        confirmation_message="Soft-delete selected comments?",
    )
    async def soft_delete(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, CommentModel)
            if filters:
                now = datetime.datetime.now(datetime.timezone.utc)
                async with async_session_maker() as session:
                    stmt = select(CommentModel).where(or_(*filters))
                    comments = (await session.execute(stmt)).scalars().all()
                    for comment in comments:
                        if comment.deleted_at is None:
                            comment.deleted_at = now
                            comment.updated_at = now
                    await session.commit()

        return self._build_list_redirect(request, self.identity)

    @action(
        name="restore",
        label="Restore",
        confirmation_message="Restore selected comments?",
    )
    async def restore(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, CommentModel)
            if filters:
                now = datetime.datetime.now(datetime.timezone.utc)
                async with async_session_maker() as session:
                    stmt = select(CommentModel).where(or_(*filters))
                    comments = (await session.execute(stmt)).scalars().all()
                    for comment in comments:
                        if comment.deleted_at is not None:
                            comment.deleted_at = None
                            comment.updated_at = now
                    await session.commit()

        return self._build_list_redirect(request, self.identity)


class CommentReactionAdminView(OperationalModelView, model=CommentReactionModel):
    name = "Comment Reaction"
    name_plural = "Comment Reactions"
    icon = "fa-solid fa-face-smile"
    category = "Moderation"
    category_icon = "fa-solid fa-shield"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = ["comment_id", "user_id", "reaction_type", "created_at"]
    column_details_list = ["comment_id", "user_id", "reaction_type", "created_at"]
    column_searchable_list = ["comment_id", "user_id", "reaction_type"]
    column_sortable_list = ["comment_id", "user_id", "reaction_type", "created_at"]
    column_default_sort = [("created_at", True)]
    column_filters = ["reaction_type", "created_at"]


class ContentReactionAdminView(OperationalModelView, model=ContentReactionModel):
    name = "Content Reaction"
    name_plural = "Content Reactions"
    icon = "fa-solid fa-thumbs-up"
    category = "Moderation"
    category_icon = "fa-solid fa-shield"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = ["content_id", "user_id", "reaction_type", "created_at"]
    column_details_list = ["content_id", "user_id", "reaction_type", "created_at"]
    column_searchable_list = ["content_id", "user_id", "reaction_type"]
    column_sortable_list = ["content_id", "user_id", "reaction_type", "created_at"]
    column_default_sort = [("created_at", True)]
    column_filters = ["reaction_type", "created_at"]


class TagAdminView(OperationalModelView, model=TagModel):
    name = "Tag"
    name_plural = "Tags"
    icon = "fa-solid fa-tag"
    category = "Content"
    category_icon = "fa-solid fa-file-lines"

    can_create = True
    can_edit = True
    can_delete = False

    column_list = ["tag_id", "slug", "created_at"]
    column_details_list = ["tag_id", "slug", "created_at"]
    column_searchable_list = ["tag_id", "slug"]
    column_sortable_list = ["tag_id", "slug", "created_at"]
    column_default_sort = [("created_at", True)]
    column_filters = ["created_at"]


class ContentTagAdminView(OperationalModelView, model=ContentTagModel):
    name = "Content Tag"
    name_plural = "Content Tags"
    icon = "fa-solid fa-link"
    category = "Content"
    category_icon = "fa-solid fa-file-lines"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = ["content_id", "tag_id"]
    column_details_list = ["content_id", "tag_id"]
    column_searchable_list = ["content_id", "tag_id"]
    column_sortable_list = ["content_id", "tag_id"]
    column_default_sort = [("content_id", False)]


class AssetAdminView(OperationalModelView, model=AssetModel):
    name = "Asset"
    name_plural = "Assets"
    icon = "fa-solid fa-file"
    category = "Storage"
    category_icon = "fa-solid fa-hard-drive"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = [
        "asset_id",
        "owner_id",
        "asset_type",
        "status",
        "access_type",
        "detected_mime_type",
        "size_bytes",
        "created_at",
        "deleted_at",
    ]
    column_details_list = [
        "asset_id",
        "owner_id",
        "asset_type",
        "status",
        "access_type",
        "original_filename",
        "original_extension",
        "declared_mime_type",
        "detected_mime_type",
        "size_bytes",
        "asset_metadata",
        "created_at",
        "updated_at",
        "deleted_at",
    ]
    column_searchable_list = [
        "asset_id",
        "owner_id",
        "original_filename",
        "declared_mime_type",
        "detected_mime_type",
    ]
    column_sortable_list = [
        "asset_id",
        "owner_id",
        "asset_type",
        "status",
        "access_type",
        "size_bytes",
        "created_at",
        "updated_at",
        "deleted_at",
    ]
    column_default_sort = [("created_at", True)]
    column_filters = ["asset_type", "status", "access_type", "created_at", "deleted_at"]

    @action(
        name="mark_deleted",
        label="Mark deleted",
        confirmation_message="Mark selected assets as deleted?",
    )
    async def mark_deleted(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, AssetModel)
            if filters:
                now = datetime.datetime.now(datetime.timezone.utc)
                async with async_session_maker() as session:
                    stmt = select(AssetModel).where(or_(*filters))
                    assets = (await session.execute(stmt)).scalars().all()
                    for asset in assets:
                        asset.deleted_at = now
                        asset.status = AssetStatusEnum.DELETED
                        asset.updated_at = now
                    await session.commit()

        return self._build_list_redirect(request, self.identity)


class AssetVariantAdminView(OperationalModelView, model=AssetVariantModel):
    name = "Asset Variant"
    name_plural = "Asset Variants"
    icon = "fa-solid fa-layer-group"
    category = "Storage"
    category_icon = "fa-solid fa-hard-drive"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = [
        "asset_variant_id",
        "asset_id",
        "asset_variant_type",
        "status",
        "mime_type",
        "size_bytes",
        "is_primary",
        "created_at",
    ]
    column_details_list = [
        "asset_variant_id",
        "asset_id",
        "asset_variant_type",
        "storage_bucket",
        "storage_key",
        "mime_type",
        "size_bytes",
        "width",
        "height",
        "duration_ms",
        "bitrate",
        "checksum_sha256",
        "is_primary",
        "status",
        "variant_metadata",
        "created_at",
    ]
    column_searchable_list = ["asset_variant_id", "asset_id", "storage_bucket", "storage_key", "mime_type"]
    column_sortable_list = [
        "asset_variant_id",
        "asset_id",
        "asset_variant_type",
        "status",
        "size_bytes",
        "is_primary",
        "created_at",
    ]
    column_default_sort = [("created_at", True)]
    column_filters = ["asset_variant_type", "status", "is_primary", "created_at"]


class ContentAssetAdminView(OperationalModelView, model=ContentAssetModel):
    name = "Content Asset Link"
    name_plural = "Content Asset Links"
    icon = "fa-solid fa-paperclip"
    category = "Storage"
    category_icon = "fa-solid fa-hard-drive"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = ["content_id", "asset_id", "attachment_type", "position", "placement_key", "created_at", "deleted_at"]
    column_details_list = [
        "content_id",
        "asset_id",
        "attachment_type",
        "position",
        "placement_key",
        "link_metadata",
        "created_at",
        "deleted_at",
    ]
    column_searchable_list = ["content_id", "asset_id", "attachment_type", "placement_key"]
    column_sortable_list = [
        "content_id",
        "asset_id",
        "attachment_type",
        "position",
        "created_at",
        "deleted_at",
    ]
    column_default_sort = [("created_at", True)]
    column_filters = ["attachment_type", "created_at", "deleted_at"]


class SessionAdminView(OperationalModelView, model=SessionModel):
    name = "Admin Session"
    name_plural = "Admin Sessions"
    icon = "fa-solid fa-key"
    category = "System"
    category_icon = "fa-solid fa-gear"

    can_create = False
    can_edit = False
    can_delete = False

    column_list = ["session_id", "user_id", "issued_at", "expires_at"]
    column_details_list = ["session_id", "user_id", "issued_at", "expires_at"]
    column_searchable_list = ["session_id", "user_id"]
    column_sortable_list = ["session_id", "user_id", "expires_at"]
    column_default_sort = [("expires_at", True)]
    column_filters = ["expires_at"]

    @action(
        name="revoke",
        label="Revoke",
        confirmation_message="Revoke selected sessions?",
    )
    async def revoke(self, request: Request) -> RedirectResponse:
        pks = self._parse_selected_pks(request)
        if pks:
            filters = self._build_pk_filters(pks, SessionModel)
            if filters:
                async with async_session_maker() as session:
                    stmt = delete(SessionModel).where(or_(*filters))
                    await session.execute(stmt)
                    await session.commit()

        return self._build_list_redirect(request, self.identity)
