import { useContext, useEffect, useMemo, useState } from "react";

import "./ContentShareButton.css";

import { StoreContext } from "../..";
import ContentService from "../../service/ContentService";
import Modal from "../modal/Modal";
import Loader from "../loader/Loader";
import { ShareIcon } from "../icons/ArticleUiIcons";
import ChatAvatar from "../chat-avatar/ChatAvatar";
import { getAvatarUrl } from "../../utils/avatar";
import { getUserDisplayName } from "../../utils/userDisplay";


function ContentShareButton({ contentId, contentTitle = "content", className = "" }) {
    const { store } = useContext(StoreContext);
    const [isModalActive, setIsModalActive] = useState(false);
    const [chats, setChats] = useState([]);
    const [selectedChatIds, setSelectedChatIds] = useState([]);
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [chatSearchQuery, setChatSearchQuery] = useState("");

    useEffect(() => {
        if (!isModalActive || !store.isAuthenticated) {
            return;
        }

        let isMounted = true;
        const loadChats = async () => {
            setIsLoadingChats(true);
            setError("");
            setSuccess("");
            try {
                const { default: ChatService } = await import("../../service/ChatService");
                const res = await ChatService.getUserJoinedChats({ limit: 100 });
                if (isMounted) {
                    setChats(res.data || []);
                }
            } catch (e) {
                console.log(e);
                if (isMounted) {
                    setError("Failed to load chats");
                }
            } finally {
                if (isMounted) {
                    setIsLoadingChats(false);
                }
            }
        };

        loadChats();
        return () => {
            isMounted = false;
        };
    }, [isModalActive, store.isAuthenticated]);

    const selectedCount = selectedChatIds.length;
    const modalTitle = useMemo(() => `Share: ${contentTitle || "content"}`, [contentTitle]);
    const normalizedChatSearch = chatSearchQuery.trim().toLowerCase();
    const filteredChats = useMemo(() => {
        if (!normalizedChatSearch) {
            return chats;
        }

        return chats.filter((chat) => (
            getChatDisplayTitle(chat, store.user.user_id).toLowerCase().includes(normalizedChatSearch)
        ));
    }, [chats, normalizedChatSearch, store.user.user_id]);

    const toggleChat = (chatId) => {
        setSelectedChatIds((items) => (
            items.includes(chatId)
                ? items.filter((item) => item !== chatId)
                : [...items, chatId]
        ));
        setError("");
        setSuccess("");
    };

    const closeModal = () => {
        if (isSharing) {
            return;
        }
        setIsModalActive(false);
        setSelectedChatIds([]);
        setChatSearchQuery("");
        setError("");
        setSuccess("");
    };

    const shareContent = async () => {
        if (selectedChatIds.length === 0) {
            setError("Select at least one chat");
            return;
        }

        setIsSharing(true);
        setError("");
        setSuccess("");
        try {
            await ContentService.shareToChats(contentId, selectedChatIds);
            setSuccess("Sent");
            setSelectedChatIds([]);
        } catch (e) {
            console.log(e);
            setError(e?.response?.data?.detail || "Failed to send");
        } finally {
            setIsSharing(false);
        }
    };

    if (!store.isAuthenticated || !contentId) {
        return null;
    }

    return (
        <>
            <button
                type="button"
                className={`content-share-trigger ${className}`}
                onClick={() => setIsModalActive(true)}
            >
                <ShareIcon />
                <span>Share</span>
            </button>

            <Modal active={isModalActive} setActive={closeModal}>
                <div className="content-share-modal">
                    <div className="content-share-header">
                        <h2>{modalTitle}</h2>
                    </div>

                    <div className="content-share-search">
                        <input
                            type="text"
                            value={chatSearchQuery}
                            onChange={(event) => setChatSearchQuery(event.target.value)}
                            placeholder="Search chats"
                            maxLength={80}
                        />
                    </div>

                    <div className="content-share-chat-list">
                        {isLoadingChats && <Loader />}
                        {!isLoadingChats && chats.length === 0 && (
                            <p className="content-share-empty">No available chats</p>
                        )}
                        {!isLoadingChats && chats.length > 0 && filteredChats.length === 0 && (
                            <p className="content-share-empty">No chats found</p>
                        )}
                        {!isLoadingChats && filteredChats.map((chat) => (
                            <ShareChatOption
                                key={chat.chat_id}
                                chat={chat}
                                currentUserId={store.user.user_id}
                                selected={selectedChatIds.includes(chat.chat_id)}
                                onToggle={() => toggleChat(chat.chat_id)}
                            />
                        ))}
                    </div>

                    {error && <p className="content-share-error">{error}</p>}
                    {success && <p className="content-share-success">{success}</p>}

                    <div className="content-share-actions">
                        <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={isSharing}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={shareContent}
                            disabled={isSharing || selectedCount === 0}
                        >
                            {isSharing ? <Loader /> : `Send${selectedCount ? ` (${selectedCount})` : ""}`}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

function ShareChatOption({ chat, currentUserId, selected, onToggle }) {
    const directMember = chat.chat_type === "direct"
        ? chat.members?.find((member) => member.user_id !== currentUserId)
        : null;
    const title = getChatDisplayTitle(chat, currentUserId);
    const directAvatarSrc = chat.display_avatar?.small_url || getAvatarUrl(directMember, "small");
    const groupAvatarSrc = chat.display_avatar?.small_url || chat.avatar?.small_url || null;

    return (
        <button
            type="button"
            className={`content-share-chat-option${selected ? " selected" : ""}`}
            onClick={onToggle}
            aria-pressed={selected}
        >
            {
                directMember
                    ? (
                        <img
                            className="content-share-chat-option-avatar"
                            src={directAvatarSrc}
                            alt={title}
                            onError={(event) => {
                                event.currentTarget.src = "/assets/profile.svg";
                            }}
                        />
                    )
                    : (
                        <ChatAvatar
                            className="content-share-chat-option-avatar"
                            src={groupAvatarSrc}
                            title={title}
                            seed={chat.chat_id || title}
                        />
                    )
            }
            <span>{title}</span>
            <span className="content-share-checkbox" aria-hidden="true" />
        </button>
    );
}

function getChatDisplayTitle(chat, currentUserId) {
    const directMember = chat.chat_type === "direct"
        ? chat.members?.find((member) => member.user_id !== currentUserId)
        : null;
    return chat.display_title
        || (directMember ? getUserDisplayName(directMember, directMember?.username || "Untitled chat") : null)
        || chat.title
        || "Untitled chat";
}

export default ContentShareButton;
