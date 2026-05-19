import datetime
import uuid

from fastapi import APIRouter, Depends, Query

from src.auth.dependencies import get_current_user
from src.common.schemas import Status
from src.notifications.dependencies import get_notification_service
from src.notifications.enums import NotificationFilterEnum
from src.notifications.schemas import (
    NotificationBootstrapGet,
    NotificationChatSettingGet,
    NotificationGet,
    NotificationAuthorSettingGet,
    NotificationSettingUpdate,
    NotificationSettingsGet,
    NotificationUnreadCountGet,
)
from src.notifications.service import NotificationService
from src.users.schemas import UserGet


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


@router.get("/bootstrap")
async def get_notifications_bootstrap(
    user: UserGet = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationBootstrapGet:
    return await service.get_bootstrap(recipient_id=user.user_id)


@router.get("")
async def get_notifications(
    type: NotificationFilterEnum = NotificationFilterEnum.ALL,
    limit: int = Query(default=20, ge=1, le=100),
    before: datetime.datetime | None = None,
    user: UserGet = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> list[NotificationGet]:
    return await service.get_notifications(
        recipient_id=user.user_id,
        notification_filter=type,
        limit=limit,
        before=before,
    )


@router.get("/unread-count")
async def get_unread_count(
    user: UserGet = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationUnreadCountGet:
    return await service.get_unread_count(recipient_id=user.user_id)


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    user: UserGet = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationGet:
    return await service.mark_read(
        notification_id=notification_id,
        recipient_id=user.user_id,
    )


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    user: UserGet = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> Status:
    updated_count = await service.mark_all_read(recipient_id=user.user_id)
    return Status(detail=f"Marked {updated_count} notifications as read")


@router.get("/settings")
async def get_notification_settings(
    user: UserGet = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationSettingsGet:
    return await service.get_settings(user_id=user.user_id)


@router.patch("/settings/authors/{author_id}")
async def update_author_notification_settings(
    author_id: uuid.UUID,
    data: NotificationSettingUpdate,
    user: UserGet = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationAuthorSettingGet:
    return await service.update_author_setting(
        user_id=user.user_id,
        author_id=author_id,
        is_muted=data.is_muted,
    )


@router.patch("/settings/chats/{chat_id}")
async def update_chat_notification_settings(
    chat_id: uuid.UUID,
    data: NotificationSettingUpdate,
    user: UserGet = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationChatSettingGet:
    return await service.update_chat_setting(
        user_id=user.user_id,
        chat_id=chat_id,
        is_muted=data.is_muted,
    )
