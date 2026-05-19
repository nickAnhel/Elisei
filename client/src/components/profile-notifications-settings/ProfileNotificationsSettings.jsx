import { useEffect, useMemo, useState } from "react";

import "./ProfileNotificationsSettings.css";

import NotificationService from "../../service/NotificationService";
import Loader from "../loader/Loader";

const CHAT_SETTING_UPDATED_EVENT = "notifications:chat-setting-updated";

function buildMutedMap(items, keyField) {
    return new Map(items.map((item) => [item[keyField], Boolean(item.is_muted)]));
}

function getRequestErrorMessage(error, fallbackMessage) {
    return error?.response?.data?.detail || fallbackMessage;
}

function ProfileNotificationsSettings() {
    const [initialAuthors, setInitialAuthors] = useState([]);
    const [draftAuthors, setDraftAuthors] = useState([]);
    const [initialChats, setInitialChats] = useState([]);
    const [draftChats, setDraftChats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saveSuccess, setSaveSuccess] = useState("");

    const hasData = useMemo(
        () => initialAuthors.length > 0 || initialChats.length > 0,
        [initialAuthors.length, initialChats.length],
    );

    const hasUnsavedChanges = useMemo(() => {
        if (initialAuthors.length !== draftAuthors.length || initialChats.length !== draftChats.length) {
            return true;
        }

        const initialAuthorMutedMap = buildMutedMap(initialAuthors, "author_id");
        const initialChatMutedMap = buildMutedMap(initialChats, "chat_id");

        const authorsChanged = draftAuthors.some(
            (item) => initialAuthorMutedMap.get(item.author_id) !== Boolean(item.is_muted),
        );
        const chatsChanged = draftChats.some(
            (item) => initialChatMutedMap.get(item.chat_id) !== Boolean(item.is_muted),
        );
        return authorsChanged || chatsChanged;
    }, [draftAuthors, draftChats, initialAuthors, initialChats]);

    useEffect(() => {
        const run = async () => {
            setIsLoading(true);
            setError("");
            setSaveError("");
            setSaveSuccess("");

            try {
                const res = await NotificationService.getSettings();
                const fetchedAuthors = res.data?.authors || [];
                const fetchedChats = res.data?.chats || [];
                setInitialAuthors(fetchedAuthors);
                setDraftAuthors(fetchedAuthors);
                setInitialChats(fetchedChats);
                setDraftChats(fetchedChats);
            } catch (e) {
                setError(getRequestErrorMessage(e, "Failed to load notification settings"));
            } finally {
                setIsLoading(false);
            }
        };

        run();
    }, []);

    useEffect(() => {
        const onChatSettingUpdated = (event) => {
            const detail = event?.detail;
            if (!detail?.chat_id) {
                return;
            }

            const applyChatUpdate = (prevChats) => prevChats.map((item) => (
                item.chat_id === detail.chat_id
                    ? {
                        ...item,
                        ...detail,
                        is_muted: typeof detail.is_muted === "boolean" ? detail.is_muted : item.is_muted,
                    }
                    : item
            ));

            setInitialChats(applyChatUpdate);
            setDraftChats(applyChatUpdate);
        };

        window.addEventListener(CHAT_SETTING_UPDATED_EVENT, onChatSettingUpdated);
        return () => window.removeEventListener(CHAT_SETTING_UPDATED_EVENT, onChatSettingUpdated);
    }, []);

    const toggleAuthorDraft = (authorId, enabled) => {
        if (isSaving) {
            return;
        }
        setSaveError("");
        setSaveSuccess("");
        setDraftAuthors((prev) => prev.map((item) => (
            item.author_id === authorId
                ? { ...item, is_muted: !enabled }
                : item
        )));
    };

    const toggleChatDraft = (chatId, enabled) => {
        if (isSaving) {
            return;
        }
        setSaveError("");
        setSaveSuccess("");
        setDraftChats((prev) => prev.map((item) => (
            item.chat_id === chatId
                ? { ...item, is_muted: !enabled }
                : item
        )));
    };

    const resetDraft = () => {
        if (isSaving) {
            return;
        }
        setDraftAuthors(initialAuthors);
        setDraftChats(initialChats);
        setSaveError("");
        setSaveSuccess("");
    };

    const saveChanges = async () => {
        if (isSaving || !hasUnsavedChanges) {
            return;
        }

        setIsSaving(true);
        setSaveError("");
        setSaveSuccess("");

        const initialAuthorMutedMap = buildMutedMap(initialAuthors, "author_id");
        const initialChatMutedMap = buildMutedMap(initialChats, "chat_id");

        const changedAuthors = draftAuthors.filter(
            (item) => initialAuthorMutedMap.get(item.author_id) !== Boolean(item.is_muted),
        );
        const changedChats = draftChats.filter(
            (item) => initialChatMutedMap.get(item.chat_id) !== Boolean(item.is_muted),
        );

        const requests = [
            ...changedAuthors.map((item) => (
                NotificationService.updateAuthorSetting(item.author_id, item.is_muted)
                    .then((res) => ({
                        kind: "author",
                        id: item.author_id,
                        payload: res.data,
                    }))
            )),
            ...changedChats.map((item) => (
                NotificationService.updateChatSetting(item.chat_id, item.is_muted)
                    .then((res) => ({
                        kind: "chat",
                        id: item.chat_id,
                        payload: res.data,
                    }))
            )),
        ];

        const settled = await Promise.allSettled(requests);
        const nextAuthorById = new Map();
        const nextChatById = new Map();
        const errors = [];

        settled.forEach((result) => {
            if (result.status === "fulfilled") {
                if (result.value.kind === "author") {
                    nextAuthorById.set(result.value.id, result.value.payload);
                } else if (result.value.kind === "chat") {
                    nextChatById.set(result.value.id, result.value.payload);
                }
                return;
            }
            errors.push(getRequestErrorMessage(result.reason, "Failed to save a notification setting"));
        });

        const updateInitialAuthors = (prev) => prev.map((item) => nextAuthorById.get(item.author_id) || item);
        const updateInitialChats = (prev) => prev.map((item) => nextChatById.get(item.chat_id) || item);
        const updateDraftAuthors = (prev) => prev.map((item) => nextAuthorById.get(item.author_id) || item);
        const updateDraftChats = (prev) => prev.map((item) => nextChatById.get(item.chat_id) || item);

        setInitialAuthors(updateInitialAuthors);
        setInitialChats(updateInitialChats);
        setDraftAuthors(updateDraftAuthors);
        setDraftChats(updateDraftChats);

        if (errors.length > 0) {
            setSaveError(errors.join(" "));
        } else {
            setSaveSuccess("Notification settings saved.");
        }

        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="profile-notifications-settings loading">
                <Loader />
            </div>
        );
    }

    if (error) {
        return <div className="profile-notifications-settings error">{error}</div>;
    }

    if (!hasData) {
        return <div className="profile-notifications-settings empty">No notification settings available yet.</div>;
    }

    return (
        <div className="profile-notifications-settings">
            {saveError && <div className="profile-notifications-feedback error">{saveError}</div>}
            {saveSuccess && <div className="profile-notifications-feedback success">{saveSuccess}</div>}

            <section className="profile-notifications-section">
                <h3>Subscribed authors</h3>
                {draftAuthors.length === 0 && <div className="profile-notifications-empty">No author subscriptions yet</div>}
                {draftAuthors.map((author) => {
                    const enabled = !author.is_muted;
                    const avatarSrc = author.avatar_small_url || "/assets/profile.svg";

                    return (
                        <label
                            key={author.author_id}
                            className={`notification-setting-row${isSaving ? " disabled" : ""}`}
                        >
                            <span className="notification-setting-main">
                                <img
                                    className="notification-setting-avatar"
                                    src={avatarSrc}
                                    alt=""
                                    onError={(event) => {
                                        event.currentTarget.src = "/assets/profile.svg";
                                    }}
                                />
                                <span className="notification-setting-text">
                                    <span className="notification-setting-title">{author.display_name || author.username}</span>
                                    <span className="notification-setting-subtitle">@{author.username}</span>
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                checked={enabled}
                                disabled={isSaving}
                                onChange={(event) => toggleAuthorDraft(author.author_id, event.target.checked)}
                            />
                        </label>
                    );
                })}
            </section>

            <section className="profile-notifications-section">
                <h3>Chats</h3>
                {draftChats.length === 0 && <div className="profile-notifications-empty">No chats yet</div>}
                {draftChats.map((chat) => {
                    const enabled = !chat.is_muted;
                    const isDirect = chat.chat_type === "direct";
                    const avatarSrc = isDirect
                        ? chat.avatar_small_url || "/assets/profile.svg"
                        : "/assets/chat.svg";

                    return (
                        <label
                            key={chat.chat_id}
                            className={`notification-setting-row${isSaving ? " disabled" : ""}`}
                        >
                            <span className="notification-setting-main">
                                <img
                                    className="notification-setting-avatar"
                                    src={avatarSrc}
                                    alt=""
                                    onError={(event) => {
                                        event.currentTarget.src = isDirect ? "/assets/profile.svg" : "/assets/chat.svg";
                                    }}
                                />
                                <span className="notification-setting-text">
                                    <span className="notification-setting-title">{chat.display_title || chat.title}</span>
                                    <span className="notification-setting-subtitle">{isDirect ? "Direct" : "Group"}</span>
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                checked={enabled}
                                disabled={isSaving}
                                onChange={(event) => toggleChatDraft(chat.chat_id, event.target.checked)}
                            />
                        </label>
                    );
                })}
            </section>

            <div className="profile-notifications-actions">
                <div className={`profile-notifications-unsaved${hasUnsavedChanges ? " active" : ""}`}>
                    {hasUnsavedChanges ? "You have unsaved changes" : "All changes saved"}
                </div>
                <div className="profile-notifications-action-buttons">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isSaving || !hasUnsavedChanges}
                        onClick={resetDraft}
                    >
                        Reset changes
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={isSaving || !hasUnsavedChanges}
                        onClick={saveChanges}
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProfileNotificationsSettings;
