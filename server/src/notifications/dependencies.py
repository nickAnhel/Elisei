from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.assets.dependencies import get_asset_storage
from src.assets.storage import AssetStorage
from src.common.database import get_async_session
from src.notifications.repository import NotificationRepository
from src.notifications.service import NotificationService


async def get_notification_service(
    async_session: AsyncSession = Depends(get_async_session),
    avatar_storage: AssetStorage = Depends(get_asset_storage),
) -> NotificationService:
    return NotificationService(
        repository=NotificationRepository(async_session),
        avatar_storage=avatar_storage,
    )
