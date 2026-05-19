from fastapi import FastAPI

from src.admin.admin import create_admin


def test_create_admin_registers_only_non_chat_views() -> None:
    app = FastAPI()
    admin = create_admin(app)

    identities = {view.identity for view in admin.views}

    assert "dashboard" in identities
    assert "user-model" in identities
    assert "content-model" in identities
    assert "session-model" in identities
    assert "comment-model" in identities
    assert "tag-model" in identities
    assert "asset-model" in identities

    assert "chat-model" not in identities
    assert "membership-model" not in identities
    assert "message-model" not in identities
    assert "event-model" not in identities


def test_operational_views_have_safe_defaults() -> None:
    app = FastAPI()
    admin = create_admin(app)

    by_identity = {view.identity: view for view in admin.views}

    assert by_identity["session-model"].can_create is False
    assert by_identity["session-model"].can_edit is False
    assert by_identity["session-model"].can_delete is False

    assert by_identity["asset-variant-model"].can_create is False
    assert by_identity["asset-variant-model"].can_edit is False
    assert by_identity["asset-variant-model"].can_delete is False

    user_view = by_identity["user-model"]
    assert "hashed_password" not in user_view.column_details_list
    assert "hashed_password" in user_view.column_export_exclude_list
