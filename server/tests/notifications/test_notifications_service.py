import datetime
import uuid
from dataclasses import dataclass

import pytest

from src.notifications.enums import NotificationFilterEnum, NotificationTypeEnum
from src.notifications.service import NotificationService


@dataclass
class _Actor:
    user_id: uuid.UUID
    username: str


@dataclass
class _UserSettings:
    user_id: uuid.UUID
    username: str
    display_name: str | None = None
    avatar_small_url: str | None = None


@dataclass
class _ChatSettings:
    chat_id: uuid.UUID
    title: str
    chat_type: str
    members: list[_UserSettings]


@dataclass
class _AuthorSettingRow:
    author: _UserSettings
    is_muted: bool


@dataclass
class _ChatSettingRow:
    chat: _ChatSettings
    is_muted: bool


@dataclass
class _Notification:
    notification_id: uuid.UUID
    recipient_id: uuid.UUID
    notification_type: NotificationTypeEnum
    actor_id: uuid.UUID | None
    actor: _Actor | None
    content_id: uuid.UUID | None
    chat_id: uuid.UUID | None
    message_id: uuid.UUID | None
    title: str
    body: str | None
    notification_metadata: dict
    read_at: datetime.datetime | None
    created_at: datetime.datetime


class FakeNotificationRepository:
    def __init__(self) -> None:
        self.now = datetime.datetime.now(datetime.timezone.utc)
        self.subscriptions: dict[tuple[uuid.UUID, uuid.UUID], bool] = {}
        self.memberships: dict[tuple[uuid.UUID, uuid.UUID], bool] = {}
        self.users: dict[uuid.UUID, _UserSettings] = {}
        self.chats: dict[uuid.UUID, _ChatSettings] = {}
        self.notifications: list[_Notification] = []

    async def get_publication_recipient_ids(self, *, author_id: uuid.UUID) -> list[uuid.UUID]:
        return [
            subscriber_id
            for (subscriber_id, subscribed_id), is_muted in self.subscriptions.items()
            if subscribed_id == author_id and subscriber_id != author_id and not is_muted
        ]

    async def create_publication_notifications(
        self,
        *,
        recipient_ids,
        actor_id,
        content_id,
        title,
        body,
        metadata,
    ):
        created = []
        for recipient_id in recipient_ids:
            exists = any(
                item.recipient_id == recipient_id
                and item.content_id == content_id
                and item.notification_type == NotificationTypeEnum.PUBLICATION
                for item in self.notifications
            )
            if exists:
                continue

            notification = _Notification(
                notification_id=uuid.uuid4(),
                recipient_id=recipient_id,
                notification_type=NotificationTypeEnum.PUBLICATION,
                actor_id=actor_id,
                actor=_Actor(
                    user_id=actor_id,
                    username=self.users.get(
                        actor_id,
                        _UserSettings(user_id=actor_id, username="author"),
                    ).username,
                ),
                content_id=content_id,
                chat_id=None,
                message_id=None,
                title=title,
                body=body,
                notification_metadata=metadata,
                read_at=None,
                created_at=self.now,
            )
            self.notifications.append(notification)
            created.append(notification)
        return created

    async def get_messenger_recipient_ids(self, *, chat_id: uuid.UUID, sender_id: uuid.UUID) -> list[uuid.UUID]:
        return [
            user_id
            for (membership_chat_id, user_id), is_muted in self.memberships.items()
            if membership_chat_id == chat_id and user_id != sender_id and not is_muted
        ]

    async def create_messenger_notifications(
        self,
        *,
        recipient_ids,
        actor_id,
        chat_id,
        message_id,
        title,
        body,
        metadata,
    ):
        created = []
        for recipient_id in recipient_ids:
            exists = any(
                item.recipient_id == recipient_id
                and item.message_id == message_id
                and item.notification_type == NotificationTypeEnum.MESSENGER
                for item in self.notifications
            )
            if exists:
                continue

            notification = _Notification(
                notification_id=uuid.uuid4(),
                recipient_id=recipient_id,
                notification_type=NotificationTypeEnum.MESSENGER,
                actor_id=actor_id,
                actor=_Actor(
                    user_id=actor_id,
                    username=self.users.get(
                        actor_id,
                        _UserSettings(user_id=actor_id, username="sender"),
                    ).username,
                ),
                content_id=None,
                chat_id=chat_id,
                message_id=message_id,
                title=title,
                body=body,
                notification_metadata=metadata,
                read_at=None,
                created_at=self.now,
            )
            self.notifications.append(notification)
            created.append(notification)
        return created

    async def get_multi_by_ids(self, *, notification_ids):
        return [item for item in self.notifications if item.notification_id in notification_ids]

    async def get_single(self, *, notification_id, recipient_id):
        for item in self.notifications:
            if item.notification_id == notification_id and item.recipient_id == recipient_id:
                return item
        return None

    async def get_multi(self, *, recipient_id, notification_type, limit, before):
        rows = [
            item for item in self.notifications
            if item.recipient_id == recipient_id
            and (notification_type is None or item.notification_type == notification_type)
            and (before is None or item.created_at < before)
        ]
        rows.sort(key=lambda item: item.created_at, reverse=True)
        return rows[:limit]

    async def get_unread_count(self, *, recipient_id):
        return sum(1 for item in self.notifications if item.recipient_id == recipient_id and item.read_at is None)

    async def mark_read(self, *, notification_id, recipient_id):
        item = await self.get_single(notification_id=notification_id, recipient_id=recipient_id)
        if item is None:
            return None
        item.read_at = item.read_at or datetime.datetime.now(datetime.timezone.utc)
        return item

    async def mark_all_read(self, *, recipient_id):
        changed = 0
        for item in self.notifications:
            if item.recipient_id == recipient_id and item.read_at is None:
                item.read_at = datetime.datetime.now(datetime.timezone.utc)
                changed += 1
        return changed

    async def get_author_settings(self, *, subscriber_id):
        rows = []
        for (candidate_subscriber_id, author_id), is_muted in self.subscriptions.items():
            if candidate_subscriber_id == subscriber_id:
                user = self.users.get(
                    author_id,
                    _UserSettings(user_id=author_id, username="author"),
                )
                rows.append(_AuthorSettingRow(author=user, is_muted=is_muted))
        return rows

    async def get_author_setting(self, *, subscriber_id, author_id):
        if (subscriber_id, author_id) not in self.subscriptions:
            return None
        user = self.users.get(
            author_id,
            _UserSettings(user_id=author_id, username="author"),
        )
        return _AuthorSettingRow(
            author=user,
            is_muted=self.subscriptions[(subscriber_id, author_id)],
        )

    async def get_chat_settings(self, *, user_id):
        rows = []
        for (chat_id, member_id), is_muted in self.memberships.items():
            if member_id == user_id:
                chat = self.chats.get(
                    chat_id,
                    _ChatSettings(
                        chat_id=chat_id,
                        title="Chat",
                        chat_type="group",
                        members=[],
                    ),
                )
                rows.append(_ChatSettingRow(chat=chat, is_muted=is_muted))
        return rows

    async def get_chat_setting(self, *, user_id, chat_id):
        key = (chat_id, user_id)
        if key not in self.memberships:
            return None
        chat = self.chats.get(
            chat_id,
            _ChatSettings(
                chat_id=chat_id,
                title="Chat",
                chat_type="group",
                members=[],
            ),
        )
        return _ChatSettingRow(chat=chat, is_muted=self.memberships[key])

    async def update_author_muted(self, *, subscriber_id, author_id, is_muted):
        key = (subscriber_id, author_id)
        if key not in self.subscriptions:
            return False
        self.subscriptions[key] = is_muted
        return True

    async def update_chat_muted(self, *, user_id, chat_id, is_muted):
        key = (chat_id, user_id)
        if key not in self.memberships:
            return False
        self.memberships[key] = is_muted
        return True


@pytest.fixture
def service_bundle():
    repo = FakeNotificationRepository()
    service = NotificationService(repository=repo)

    emitted = []

    async def fake_emit(notification):
        emitted.append(notification)

    service._emit_created = fake_emit  # type: ignore[assignment]
    return repo, service, emitted


@pytest.mark.asyncio
async def test_create_publication_notifications_for_subscribers(service_bundle) -> None:
    repo, service, emitted = service_bundle
    author_id = uuid.uuid4()
    follower_id = uuid.uuid4()
    repo.users[author_id] = _UserSettings(user_id=author_id, username="alice")
    repo.subscriptions[(follower_id, author_id)] = False

    notifications = await service.create_publication_notifications(
        actor_id=author_id,
        content_id=uuid.uuid4(),
        content_type="post",
        title="New post",
        body="hello",
        canonical_path="/posts/x",
    )

    assert len(notifications) == 1
    assert notifications[0].recipient_id == follower_id
    assert len(emitted) == 1


@pytest.mark.asyncio
async def test_no_publication_notification_for_self(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    author_id = uuid.uuid4()
    repo.subscriptions[(author_id, author_id)] = False

    notifications = await service.create_publication_notifications(
        actor_id=author_id,
        content_id=uuid.uuid4(),
        content_type="post",
        title="New post",
        body="hello",
        canonical_path="/posts/x",
    )

    assert notifications == []


@pytest.mark.asyncio
async def test_muted_subscription_blocks_publication_notification(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    author_id = uuid.uuid4()
    follower_id = uuid.uuid4()
    repo.subscriptions[(follower_id, author_id)] = True

    notifications = await service.create_publication_notifications(
        actor_id=author_id,
        content_id=uuid.uuid4(),
        content_type="post",
        title="New post",
        body="hello",
        canonical_path="/posts/x",
    )

    assert notifications == []


@pytest.mark.asyncio
async def test_create_message_notifications_for_chat_members_except_sender(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    chat_id = uuid.uuid4()
    sender_id = uuid.uuid4()
    receiver_id = uuid.uuid4()
    repo.users[sender_id] = _UserSettings(user_id=sender_id, username="bob")
    repo.memberships[(chat_id, sender_id)] = False
    repo.memberships[(chat_id, receiver_id)] = False

    notifications = await service.create_messenger_notifications(
        sender_id=sender_id,
        sender_username="bob",
        chat_id=chat_id,
        message_id=uuid.uuid4(),
        message_preview="Ping",
    )

    assert len(notifications) == 1
    assert notifications[0].recipient_id == receiver_id


@pytest.mark.asyncio
async def test_muted_chat_member_does_not_receive_message_notification(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    chat_id = uuid.uuid4()
    sender_id = uuid.uuid4()
    muted_member_id = uuid.uuid4()
    repo.memberships[(chat_id, sender_id)] = False
    repo.memberships[(chat_id, muted_member_id)] = True

    notifications = await service.create_messenger_notifications(
        sender_id=sender_id,
        sender_username="bob",
        chat_id=chat_id,
        message_id=uuid.uuid4(),
        message_preview="Ping",
    )

    assert notifications == []


@pytest.mark.asyncio
async def test_unread_count(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    recipient_id = uuid.uuid4()
    actor_id = uuid.uuid4()
    repo.users[actor_id] = _UserSettings(user_id=actor_id, username="alice")
    repo.subscriptions[(recipient_id, actor_id)] = False

    await service.create_publication_notifications(
        actor_id=actor_id,
        content_id=uuid.uuid4(),
        content_type="post",
        title="New post",
        body="hello",
        canonical_path="/posts/x",
    )

    unread = await service.get_unread_count(recipient_id=recipient_id)
    assert unread.unread_count == 1


@pytest.mark.asyncio
async def test_mark_one_read(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    recipient_id = uuid.uuid4()
    actor_id = uuid.uuid4()
    repo.subscriptions[(recipient_id, actor_id)] = False

    created = await service.create_publication_notifications(
        actor_id=actor_id,
        content_id=uuid.uuid4(),
        content_type="post",
        title="New post",
        body="hello",
        canonical_path="/posts/x",
    )

    updated = await service.mark_read(
        notification_id=created[0].notification_id,
        recipient_id=recipient_id,
    )
    assert updated.read_at is not None


@pytest.mark.asyncio
async def test_mark_all_read(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    recipient_id = uuid.uuid4()
    actor_id = uuid.uuid4()
    repo.subscriptions[(recipient_id, actor_id)] = False

    await service.create_publication_notifications(
        actor_id=actor_id,
        content_id=uuid.uuid4(),
        content_type="post",
        title="New post",
        body="hello",
        canonical_path="/posts/x",
    )
    await service.create_publication_notifications(
        actor_id=actor_id,
        content_id=uuid.uuid4(),
        content_type="post",
        title="Another post",
        body="hello",
        canonical_path="/posts/y",
    )

    changed = await service.mark_all_read(recipient_id=recipient_id)
    assert changed == 2

    unread = await service.get_unread_count(recipient_id=recipient_id)
    assert unread.unread_count == 0


@pytest.mark.asyncio
async def test_update_author_notification_setting_through_subscription_muted(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    subscriber_id = uuid.uuid4()
    author_id = uuid.uuid4()
    repo.users[author_id] = _UserSettings(
        user_id=author_id,
        username="writer",
        display_name="Writer Name",
    )
    repo.subscriptions[(subscriber_id, author_id)] = False

    updated = await service.update_author_setting(
        user_id=subscriber_id,
        author_id=author_id,
        is_muted=True,
    )

    assert updated.author_id == author_id
    assert updated.display_name == "Writer Name"
    assert updated.is_muted is True
    assert repo.subscriptions[(subscriber_id, author_id)] is True


@pytest.mark.asyncio
async def test_update_chat_notification_setting_through_chat_user_muted(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    user_id = uuid.uuid4()
    chat_id = uuid.uuid4()
    repo.chats[chat_id] = _ChatSettings(
        chat_id=chat_id,
        title="Chat room",
        chat_type="group",
        members=[],
    )
    repo.memberships[(chat_id, user_id)] = False

    updated = await service.update_chat_setting(
        user_id=user_id,
        chat_id=chat_id,
        is_muted=True,
    )

    assert updated.chat_id == chat_id
    assert updated.display_title == "Chat room"
    assert updated.is_muted is True
    assert repo.memberships[(chat_id, user_id)] is True


@pytest.mark.asyncio
async def test_get_settings_returns_author_display_name_and_avatar(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    subscriber_id = uuid.uuid4()
    author_id = uuid.uuid4()
    repo.users[author_id] = _UserSettings(
        user_id=author_id,
        username="writer",
        display_name="Writer Display",
        avatar_small_url="https://cdn.example/avatar-small.png",
    )
    repo.subscriptions[(subscriber_id, author_id)] = False

    settings = await service.get_settings(user_id=subscriber_id)

    assert len(settings.authors) == 1
    author_setting = settings.authors[0]
    assert author_setting.author_id == author_id
    assert author_setting.username == "writer"
    assert author_setting.display_name == "Writer Display"
    assert author_setting.avatar_small_url == "https://cdn.example/avatar-small.png"


@pytest.mark.asyncio
async def test_get_settings_returns_direct_chat_title_for_other_user(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    user_id = uuid.uuid4()
    other_id = uuid.uuid4()
    chat_id = uuid.uuid4()
    current_user = _UserSettings(
        user_id=user_id,
        username="self-user",
        display_name="Self User",
    )
    other_user = _UserSettings(
        user_id=other_id,
        username="other-user",
        display_name="Other Display",
        avatar_small_url="https://cdn.example/other-avatar.png",
    )
    repo.chats[chat_id] = _ChatSettings(
        chat_id=chat_id,
        title="Direct chat",
        chat_type="direct",
        members=[current_user, other_user],
    )
    repo.memberships[(chat_id, user_id)] = False

    settings = await service.get_settings(user_id=user_id)

    assert len(settings.chats) == 1
    chat_setting = settings.chats[0]
    assert chat_setting.chat_id == chat_id
    assert chat_setting.title == "Direct chat"
    assert chat_setting.display_title == "Other Display"
    assert chat_setting.avatar_small_url == "https://cdn.example/other-avatar.png"


@pytest.mark.asyncio
async def test_list_notifications_by_filter(service_bundle) -> None:
    repo, service, _emitted = service_bundle
    author_id = uuid.uuid4()
    follower_id = uuid.uuid4()
    chat_id = uuid.uuid4()
    repo.subscriptions[(follower_id, author_id)] = False
    repo.memberships[(chat_id, follower_id)] = False

    await service.create_publication_notifications(
        actor_id=author_id,
        content_id=uuid.uuid4(),
        content_type="post",
        title="pub",
        body=None,
        canonical_path="/posts/a",
    )
    await service.create_messenger_notifications(
        sender_id=author_id,
        sender_username="alice",
        chat_id=chat_id,
        message_id=uuid.uuid4(),
        message_preview="hello",
    )

    publication_items = await service.get_notifications(
        recipient_id=follower_id,
        notification_filter=NotificationFilterEnum.PUBLICATION,
        limit=20,
        before=None,
    )

    assert len(publication_items) == 1
    assert publication_items[0].notification_type == NotificationTypeEnum.PUBLICATION
