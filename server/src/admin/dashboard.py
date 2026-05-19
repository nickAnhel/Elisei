from __future__ import annotations

import datetime
from collections import defaultdict

from sqlalchemy import case, func, select
from sqladmin import BaseView, expose
from starlette.requests import Request

from src.admin.models import SessionModel
from src.assets.models import AssetModel, AssetVariantModel
from src.comments.models import CommentModel, CommentReactionModel
from src.common.database import async_session_maker
from src.content.enums import ContentStatusEnum, ContentVisibilityEnum
from src.content.models import ContentModel, ContentReactionModel
from src.tags.models import TagModel
from src.users.models import UserModel


def _format_bytes(size_bytes: int | None) -> str:
    if size_bytes is None or size_bytes <= 0:
        return "0 B"

    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(size_bytes)
    unit_idx = 0

    while value >= 1024 and unit_idx < len(units) - 1:
        value /= 1024
        unit_idx += 1

    if unit_idx == 0:
        return f"{int(value)} {units[unit_idx]}"

    return f"{value:.1f} {units[unit_idx]}"


async def build_dashboard_context() -> dict[str, object]:
    async with async_session_maker() as session:
        user_counts_stmt = select(
            func.count(UserModel.user_id).label("total_users"),
            func.count(case((UserModel.is_admin.is_(True), 1))).label("admin_users"),
        )
        user_counts_row = (await session.execute(user_counts_stmt)).one()

        content_counts_stmt = select(
            func.count(ContentModel.content_id).label("total_content"),
            func.count(case((ContentModel.status == ContentStatusEnum.PUBLISHED, 1))).label("published_content"),
            func.count(case((ContentModel.status == ContentStatusEnum.DRAFT, 1))).label("draft_content"),
            func.count(case((ContentModel.visibility == ContentVisibilityEnum.PRIVATE, 1))).label("private_content"),
        )
        content_counts_row = (await session.execute(content_counts_stmt)).one()

        comments_counts_stmt = select(
            func.count(CommentModel.comment_id).label("total_comments"),
            func.count(case((CommentModel.deleted_at.is_not(None), 1))).label("deleted_comments"),
        )
        comments_counts_row = (await session.execute(comments_counts_stmt)).one()

        total_tags = (await session.execute(select(func.count(TagModel.tag_id)))).scalar_one()
        content_reactions_count = (
            await session.execute(select(func.count()).select_from(ContentReactionModel))
        ).scalar_one()
        comment_reactions_count = (
            await session.execute(select(func.count()).select_from(CommentReactionModel))
        ).scalar_one()

        asset_counts_stmt = select(
            func.count(AssetModel.asset_id).label("total_assets"),
            func.coalesce(func.sum(AssetModel.size_bytes), 0).label("asset_size_total"),
            func.count(case((AssetModel.deleted_at.is_not(None), 1))).label("deleted_assets"),
        )
        asset_counts_row = (await session.execute(asset_counts_stmt)).one()

        asset_variants_stmt = select(
            func.count(AssetVariantModel.asset_variant_id).label("total_asset_variants"),
            func.coalesce(func.sum(AssetVariantModel.size_bytes), 0).label("variant_size_total"),
        )
        asset_variants_row = (await session.execute(asset_variants_stmt)).one()

        content_status_rows = (
            await session.execute(
                select(ContentModel.status, func.count(ContentModel.content_id)).group_by(ContentModel.status)
            )
        ).all()
        content_visibility_rows = (
            await session.execute(
                select(ContentModel.visibility, func.count(ContentModel.content_id)).group_by(ContentModel.visibility)
            )
        ).all()

        comment_status_stmt = select(
            func.count(CommentModel.comment_id).label("total"),
            func.count(case((CommentModel.deleted_at.is_(None), 1))).label("active"),
            func.count(case((CommentModel.deleted_at.is_not(None), 1))).label("deleted"),
        )
        comment_status_row = (await session.execute(comment_status_stmt)).one()

        asset_status_rows = (
            await session.execute(
                select(AssetModel.status, func.count(AssetModel.asset_id)).group_by(AssetModel.status)
            )
        ).all()
        asset_variant_status_rows = (
            await session.execute(
                select(AssetVariantModel.status, func.count(AssetVariantModel.asset_variant_id)).group_by(AssetVariantModel.status)
            )
        ).all()

        latest_users = (
            await session.execute(
                select(
                    UserModel.user_id,
                    UserModel.username,
                    UserModel.is_admin,
                    UserModel.created_at,
                )
                .order_by(UserModel.created_at.desc())
                .limit(5)
            )
        ).all()

        latest_content = (
            await session.execute(
                select(
                    ContentModel.content_id,
                    ContentModel.content_type,
                    ContentModel.status,
                    ContentModel.visibility,
                    ContentModel.author_id,
                    ContentModel.created_at,
                )
                .order_by(ContentModel.created_at.desc())
                .limit(5)
            )
        ).all()

        latest_comments = (
            await session.execute(
                select(
                    CommentModel.comment_id,
                    CommentModel.content_id,
                    CommentModel.author_id,
                    CommentModel.deleted_at,
                    CommentModel.created_at,
                )
                .order_by(CommentModel.created_at.desc())
                .limit(5)
            )
        ).all()

        active_sessions = (
            await session.execute(select(func.count(SessionModel.session_id)))
        ).scalar_one()

    content_by_status = defaultdict(int)
    for status, count in content_status_rows:
        key = status.value if status is not None else "unknown"
        content_by_status[key] = count

    content_by_visibility = defaultdict(int)
    for visibility, count in content_visibility_rows:
        key = visibility.value if visibility is not None else "unknown"
        content_by_visibility[key] = count

    assets_by_status = defaultdict(int)
    for status, count in asset_status_rows:
        key = status.value if status is not None else "unknown"
        assets_by_status[key] = count

    variants_by_status = defaultdict(int)
    for status, count in asset_variant_status_rows:
        key = status.value if status is not None else "unknown"
        variants_by_status[key] = count

    total_reactions = content_reactions_count + comment_reactions_count
    total_storage_size = int(asset_variants_row.variant_size_total or 0) + int(asset_counts_row.asset_size_total or 0)

    key_metrics = {
        "total_users": int(user_counts_row.total_users),
        "admin_users": int(user_counts_row.admin_users),
        "total_content": int(content_counts_row.total_content),
        "published_content": int(content_counts_row.published_content),
        "draft_content": int(content_counts_row.draft_content),
        "private_content": int(content_counts_row.private_content),
        "total_comments": int(comments_counts_row.total_comments),
        "deleted_comments": int(comments_counts_row.deleted_comments),
        "total_tags": int(total_tags),
        "total_reactions": int(total_reactions),
        "total_assets": int(asset_counts_row.total_assets),
        "total_asset_variants": int(asset_variants_row.total_asset_variants),
        "total_storage_size": total_storage_size,
        "total_storage_size_human": _format_bytes(total_storage_size),
    }

    compact_overview = {
        "content_by_status": dict(content_by_status),
        "content_by_visibility": dict(content_by_visibility),
        "comments_status": {
            "total": int(comment_status_row.total),
            "active": int(comment_status_row.active),
            "deleted": int(comment_status_row.deleted),
        },
        "storage_overview": {
            "assets_by_status": dict(assets_by_status),
            "variants_by_status": dict(variants_by_status),
            "assets_total_size_bytes": int(asset_counts_row.asset_size_total or 0),
            "assets_total_size_human": _format_bytes(int(asset_counts_row.asset_size_total or 0)),
            "variants_total_size_bytes": int(asset_variants_row.variant_size_total or 0),
            "variants_total_size_human": _format_bytes(int(asset_variants_row.variant_size_total or 0)),
            "active_admin_sessions": int(active_sessions),
        },
    }

    return {
        "title": "Dashboard",
        "subtitle": "Operational overview of users, content, moderation and storage",
        "last_updated_at": datetime.datetime.now(datetime.timezone.utc),
        "key_metrics": key_metrics,
        "compact_overview": compact_overview,
        "latest_users": latest_users,
        "latest_content": latest_content,
        "latest_comments": latest_comments,
    }


class DashboardAdminView(BaseView):
    name = "Dashboard"
    identity = "dashboard"
    icon = "fa-solid fa-chart-simple"
    category = "System"
    category_icon = "fa-solid fa-gear"

    @expose("/dashboard", methods=["GET"], identity="dashboard")
    async def dashboard(self, request: Request):
        context = await build_dashboard_context()
        return await self.templates.TemplateResponse(request, "sqladmin/dashboard.html", context)
