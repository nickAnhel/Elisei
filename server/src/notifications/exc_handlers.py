from fastapi import HTTPException, status

from src.notifications.exceptions import (
    NotificationAuthorSettingsNotFound,
    NotificationChatSettingsNotFound,
    NotificationNotFound,
)


async def notification_not_found_handler(request, exc: NotificationNotFound):
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=str(exc),
    )


async def notification_author_settings_not_found_handler(
    request,
    exc: NotificationAuthorSettingsNotFound,
):
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=str(exc),
    )


async def notification_chat_settings_not_found_handler(
    request,
    exc: NotificationChatSettingsNotFound,
):
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=str(exc),
    )
