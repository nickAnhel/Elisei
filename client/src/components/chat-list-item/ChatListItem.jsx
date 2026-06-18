import { forwardRef, useContext } from "react";
import { NavLink } from "react-router-dom";

import "./ChatListItem.css";

import { StoreContext } from "../..";
import ChatAvatar from "../chat-avatar/ChatAvatar";
import { getAvatarUrl } from "../../utils/avatar";
import { getUserDisplayName } from "../../utils/userDisplay";

function formatChatTime(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function buildLastMessagePreview(lastMessage, currentUserId) {
    if (!lastMessage) {
        return {
            text: "No messages yet",
            tone: "empty",
        };
    }

    if (lastMessage.deleted_at || lastMessage.deletedAt) {
        return {
            text: "Message deleted",
            tone: "deleted",
        };
    }

    const ownPrefix = lastMessage.user_id === currentUserId ? "You: " : "";
    const content = lastMessage.content || "";
    if (content.trim()) {
        return {
            text: `${ownPrefix}${content}`,
            tone: "text",
        };
    }

    if (lastMessage.shared_content) {
        const shared = lastMessage.shared_content;
        if (shared.is_available === false) {
            return {
                text: `${ownPrefix}${shared.unavailable_message || "You can't view this content"}`,
                tone: "unavailable",
            };
        }

        return {
            text: `${ownPrefix}Shared ${shared.content_type || "content"}: ${shared.title || shared.excerpt || shared.post_content || ""}`,
            tone: "attachment",
        };
    }

    const attachmentsCount = Array.isArray(lastMessage.attachments)
        ? lastMessage.attachments.length
        : 0;
    if (attachmentsCount > 0) {
        return {
            text: `${ownPrefix}${attachmentsCount} ${attachmentsCount === 1 ? "attachment" : "attachments"}`,
            tone: "attachment",
        };
    }

    return {
        text: "No messages yet",
        tone: "empty",
    };
}


const ChatListItem = forwardRef((props, ref) => {
    const { store } = useContext(StoreContext);
    const chat = props.chat;
    const directMember = chat.chat_type === "direct"
        ? chat.members?.find((member) => member.user_id !== store.user.user_id)
        : null;
    const title = chat.display_title
        || (directMember ? getUserDisplayName(directMember, directMember?.username || "Direct chat") : null)
        || chat.title
        || "Direct chat";
    const groupAvatar = chat.display_avatar?.small_url || chat.avatar?.small_url;
    const directAvatarSrc = chat.display_avatar?.small_url || getAvatarUrl(directMember, "small");
    const lastMessagePreview = buildLastMessagePreview(chat.last_message, store.user.user_id);
    const lastMessageAt = chat.last_message_at || chat.last_message?.created_at;
    const unreadCount = chat.unread_count || 0;
    const isMuted = Boolean(
        chat.is_muted
        || chat.notification_settings?.is_muted
        || chat.settings?.is_muted,
    );
    return (
        <NavLink
            className={({ isActive }) => [
                "chat-list-item",
                unreadCount > 0 ? "unread" : "",
                isActive ? "active" : "",
            ].filter(Boolean).join(" ")}
            ref={ref}
            to={`/chats/@${chat.chat_id}`}
            data-testid="chat-list-item"
        >
            {
                directMember
                    ? (
                        <img
                            className="chat-image"
                            src={directAvatarSrc}
                            alt={title}
                            onError={(event) => {
                                event.currentTarget.src = "/assets/profile.svg";
                            }}
                        />
                    )
                    : (
                        <ChatAvatar
                            className="chat-image"
                            src={groupAvatar || null}
                            title={title}
                            seed={chat.chat_id || title}
                        />
                    )
            }
            <div className="info">
                <div className="chat-list-item__top">
                    <div className="title" title={title}>{title}</div>
                    <div className="time">{formatChatTime(lastMessageAt)}</div>
                </div>
                <div className="chat-list-item__middle">
                    <div className={`last-message tone-${lastMessagePreview.tone}`}>
                        {lastMessagePreview.text}
                    </div>
                    {unreadCount > 0 && <div className="unread-count">{unreadCount}</div>}
                </div>
                {isMuted && (
                    <div className="chat-list-item__bottom">
                        <span className="chat-muted">Muted</span>
                    </div>
                )}
            </div>
        </NavLink>
    );
});

export default ChatListItem;
