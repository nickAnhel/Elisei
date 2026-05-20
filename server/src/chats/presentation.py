from __future__ import annotations

import typing as tp
from typing import TYPE_CHECKING

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import NoInspectionAvailable
from sqlalchemy.orm.attributes import NO_VALUE

from src.assets.enums import AssetVariantStatusEnum, AssetVariantTypeEnum
from src.chats.schemas import ChatAvatarCrop, ChatAvatarGet

if TYPE_CHECKING:
    from src.assets.storage import AssetStorage


async def build_chat_avatar_get(
    chat: tp.Any,
    *,
    storage: AssetStorage,
) -> ChatAvatarGet | None:
    if getattr(chat, "avatar_asset_id", None) is None or getattr(chat, "avatar_crop", None) is None:
        return None

    avatar_asset = _loaded_relationship_or_default(chat, "avatar_asset", None)
    if avatar_asset is None:
        return None

    crop = ChatAvatarCrop.model_validate(chat.avatar_crop)
    small_url = None
    medium_url = None

    for variant in _loaded_relationship_or_default(avatar_asset, "variants", []):
        if variant.status != AssetVariantStatusEnum.READY:
            continue

        if variant.asset_variant_type == AssetVariantTypeEnum.AVATAR_SMALL:
            small_url = await storage.generate_presigned_get(
                bucket=variant.storage_bucket,
                key=variant.storage_key,
            )
        elif variant.asset_variant_type == AssetVariantTypeEnum.AVATAR_MEDIUM:
            medium_url = await storage.generate_presigned_get(
                bucket=variant.storage_bucket,
                key=variant.storage_key,
            )

    return ChatAvatarGet(
        small_url=small_url,
        medium_url=medium_url,
        crop=crop,
    )


def _loaded_relationship_or_default(
    instance: tp.Any,
    name: str,
    default: tp.Any,
) -> tp.Any:
    try:
        state = sa_inspect(instance)
    except NoInspectionAvailable:
        return getattr(instance, name, default)

    try:
        loaded_value = state.attrs[name].loaded_value
    except KeyError:
        return getattr(instance, name, default)

    if loaded_value is NO_VALUE:
        return default
    return loaded_value
