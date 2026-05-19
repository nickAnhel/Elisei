import api from "../http";


function normalizeEntityId(value) {
    if (typeof value !== "string") {
        return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return "";
    }
    return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export default class NotificationService {
    static async bootstrap() {
        return api.get("/notifications/bootstrap");
    }

    static async getNotifications(params) {
        return api.get("/notifications", { params });
    }

    static async getUnreadCount() {
        return api.get("/notifications/unread-count");
    }

    static async markRead(notificationId) {
        return api.patch(`/notifications/${notificationId}/read`);
    }

    static async markAllRead() {
        return api.post("/notifications/mark-all-read");
    }

    static async getSettings() {
        return api.get("/notifications/settings");
    }

    static async updateAuthorSetting(authorId, isMuted) {
        const normalizedAuthorId = normalizeEntityId(authorId);
        if (!normalizedAuthorId) {
            throw new Error("Invalid author id for notification settings update");
        }
        return api.patch(`/notifications/settings/authors/${normalizedAuthorId}`, {
            is_muted: Boolean(isMuted),
            isMuted: Boolean(isMuted),
        });
    }

    static async updateChatSetting(chatId, isMuted) {
        const normalizedChatId = normalizeEntityId(chatId);
        if (!normalizedChatId) {
            throw new Error("Invalid chat id for notification settings update");
        }
        return api.patch(`/notifications/settings/chats/${normalizedChatId}`, {
            is_muted: Boolean(isMuted),
            isMuted: Boolean(isMuted),
        });
    }
}
