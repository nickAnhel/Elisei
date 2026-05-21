import { useEffect, useMemo, useRef, useState } from "react";

import "./ChatModal.css";

import Modal from "../modal/Modal";
import Loader from "../loader/Loader";
import UserService from "../../service/UserService";
import AssetService from "../../service/AssetService";
import ChatService from "../../service/ChatService";
import {
    buildCenteredOffset,
    buildCropPayload,
    clamp,
    constrainOffset,
    getRenderedSize,
} from "../../utils/avatarCrop";


const CHAT_AVATAR_VIEWPORT_SIZE = 240;
const CHAT_AVATAR_MAX_ZOOM = 10;


function ChatModal({
    active,
    setActive,

    chatId,
    title,
    isPrivate,
    avatar,
    chatType = "group",
    setTitle,
    saveChatFunc,
    onSaved,

    modalHeader,
    buttonText,
}) {
    const dragStateRef = useRef(null);
    const fileInputRef = useRef(null);

    const [chatTitle, setChatTitle] = useState(title || "");
    const [chatIsPrivate, setChatIsPrivate] = useState(Boolean(isPrivate));
    const [isLoadingSaveChat, setIsLoadingSaveChat] = useState(false);
    const [formError, setFormError] = useState("");

    const [memberQuery, setMemberQuery] = useState("");
    const [memberResults, setMemberResults] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);

    const [avatarError, setAvatarError] = useState("");
    const [isAvatarActionLoading, setIsAvatarActionLoading] = useState(false);
    const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState("");
    const [avatarImageSize, setAvatarImageSize] = useState(null);
    const [avatarCropScale, setAvatarCropScale] = useState(1);
    const [avatarCropOffset, setAvatarCropOffset] = useState({ x: 0, y: 0 });
    const [createdChatId, setCreatedChatId] = useState(null);
    const [savedChat, setSavedChat] = useState(null);

    const canEditMembers = !chatId && !createdChatId;
    const effectiveChatId = chatId || createdChatId;
    const effectiveAvatar = savedChat?.avatar || avatar || null;
    const effectiveChatType = savedChat?.chat_type || chatType || "group";
    const isGroupChat = effectiveChatType !== "direct";
    const avatarZoomFillPercent = CHAT_AVATAR_MAX_ZOOM <= 1
        ? 0
        : clamp(((avatarCropScale - 1) / (CHAT_AVATAR_MAX_ZOOM - 1)) * 100, 0, 100);

    useEffect(() => {
        setChatTitle(title || "");
        setChatIsPrivate(Boolean(isPrivate));
        setFormError("");
        setAvatarError("");
        setSavedChat(null);
        setCreatedChatId(null);
        setSelectedAvatarFile(null);
        setAvatarImageSize(null);
        setAvatarCropScale(1);
        setAvatarCropOffset({ x: 0, y: 0 });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        if (active && !chatId) {
            setMemberQuery("");
            setMemberResults([]);
            setSelectedMembers([]);
        }
    }, [active, chatId, title, isPrivate]);

    useEffect(() => {
        if (!selectedAvatarFile) {
            setAvatarPreview("");
            return;
        }

        const objectUrl = URL.createObjectURL(selectedAvatarFile);
        setAvatarPreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [selectedAvatarFile]);

    useEffect(() => {
        if (!active || !canEditMembers || memberQuery.trim().length < 1) {
            setMemberResults([]);
            return;
        }

        const timeout = setTimeout(async () => {
            setIsLoadingMembers(true);
            try {
                const res = await UserService.searchUsers({
                    query: memberQuery.trim(),
                    offset: 0,
                    limit: 6,
                });
                setMemberResults(res.data);
            } catch (_error) {
                setMemberResults([]);
            } finally {
                setIsLoadingMembers(false);
            }
        }, 250);

        return () => clearTimeout(timeout);
    }, [active, canEditMembers, memberQuery]);

    const addMember = (user) => {
        if (selectedMembers.some((member) => member.user_id === user.user_id)) {
            return;
        }

        setSelectedMembers((members) => [...members, user]);
        setMemberQuery("");
        setMemberResults([]);
    };

    const removeMember = (userId) => {
        setSelectedMembers((members) => members.filter((member) => member.user_id !== userId));
    };

    const resetAvatarCrop = () => {
        if (!avatarImageSize) {
            return;
        }

        setAvatarCropScale(1);
        setAvatarCropOffset(buildCenteredOffset(avatarImageSize, 1, CHAT_AVATAR_VIEWPORT_SIZE));
    };

    const clearPendingAvatarSelection = () => {
        setSelectedAvatarFile(null);
        setAvatarImageSize(null);
        setAvatarCropScale(1);
        setAvatarCropOffset({ x: 0, y: 0 });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSelectAvatar = (event) => {
        const nextFile = event.target.files?.[0];
        setAvatarError("");
        setAvatarImageSize(null);

        if (!nextFile) {
            setSelectedAvatarFile(null);
            return;
        }

        setSelectedAvatarFile(nextFile);
    };

    const handleAvatarPreviewLoad = (event) => {
        const nextImageSize = {
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
        };

        setAvatarImageSize(nextImageSize);
        setAvatarCropScale(1);
        setAvatarCropOffset(buildCenteredOffset(nextImageSize, 1, CHAT_AVATAR_VIEWPORT_SIZE));
    };

    const handleAvatarZoomChange = (event) => {
        if (!avatarImageSize) {
            return;
        }

        const nextScale = clamp(Number(event.target.value), 1, CHAT_AVATAR_MAX_ZOOM);
        const previousFactor = getRenderedSize(
            avatarImageSize,
            avatarCropScale,
            CHAT_AVATAR_VIEWPORT_SIZE,
        ).factor;
        const nextFactor = getRenderedSize(
            avatarImageSize,
            nextScale,
            CHAT_AVATAR_VIEWPORT_SIZE,
        ).factor;
        const cropCenterX = (CHAT_AVATAR_VIEWPORT_SIZE / 2 - avatarCropOffset.x) / previousFactor;
        const cropCenterY = (CHAT_AVATAR_VIEWPORT_SIZE / 2 - avatarCropOffset.y) / previousFactor;
        const nextOffset = constrainOffset(
            {
                x: CHAT_AVATAR_VIEWPORT_SIZE / 2 - cropCenterX * nextFactor,
                y: CHAT_AVATAR_VIEWPORT_SIZE / 2 - cropCenterY * nextFactor,
            },
            avatarImageSize,
            nextScale,
            CHAT_AVATAR_VIEWPORT_SIZE,
        );

        setAvatarCropScale(nextScale);
        setAvatarCropOffset(nextOffset);
    };

    const handleAvatarPointerDown = (event) => {
        if (!avatarImageSize) {
            return;
        }

        dragStateRef.current = {
            x: event.clientX,
            y: event.clientY,
            offset: avatarCropOffset,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleAvatarPointerMove = (event) => {
        if (!dragStateRef.current || !avatarImageSize) {
            return;
        }

        const deltaX = event.clientX - dragStateRef.current.x;
        const deltaY = event.clientY - dragStateRef.current.y;

        setAvatarCropOffset(constrainOffset(
            {
                x: dragStateRef.current.offset.x + deltaX,
                y: dragStateRef.current.offset.y + deltaY,
            },
            avatarImageSize,
            avatarCropScale,
            CHAT_AVATAR_VIEWPORT_SIZE,
        ));
    };

    const handleAvatarPointerUp = (event) => {
        dragStateRef.current = null;
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const uploadAndSetAvatar = async (targetChatId) => {
        if (!selectedAvatarFile || !avatarImageSize) {
            return null;
        }

        const crop = buildCropPayload(
            avatarImageSize,
            avatarCropScale,
            avatarCropOffset,
            CHAT_AVATAR_VIEWPORT_SIZE,
        );
        const initRes = await AssetService.initUpload({
            filename: selectedAvatarFile.name,
            size_bytes: selectedAvatarFile.size,
            declared_mime_type: selectedAvatarFile.type || null,
            asset_type: "image",
            usage_context: "chat_avatar",
        });
        const uploadRes = await AssetService.uploadFile(
            initRes.data.upload_url,
            selectedAvatarFile,
            initRes.data.upload_headers || {},
        );
        if (!uploadRes.ok) {
            const uploadErrorText = await uploadRes.text();
            throw new Error(uploadErrorText || "Failed to upload chat avatar source image.");
        }

        const finalizeRes = await AssetService.finalizeUpload(initRes.data.asset.asset_id);
        const avatarRes = await ChatService.updateChatAvatar(targetChatId, {
            asset_id: finalizeRes.data.asset.asset_id,
            crop,
        });

        return avatarRes.data;
    };

    const closeModal = () => {
        if (isLoadingSaveChat || isAvatarActionLoading) {
            return;
        }

        setActive(false);
    };

    const handleSaveChat = async (event) => {
        event.preventDefault();
        if (isLoadingSaveChat || isAvatarActionLoading) {
            return;
        }

        setFormError("");
        setAvatarError("");
        setIsLoadingSaveChat(true);

        const createChatData = {
            chat_type: "group",
            title: chatTitle,
            is_private: chatIsPrivate,
            members: selectedMembers.map((member) => member.user_id),
        };
        const updateChatData = {
            title: chatTitle,
            is_private: chatIsPrivate,
        };

        let baseChat = savedChat;
        const needsCreate = !chatId && !createdChatId;

        try {
            if (needsCreate) {
                const createRes = await saveChatFunc(createChatData);
                baseChat = createRes?.data;
                setCreatedChatId(baseChat?.chat_id || null);
            } else if (chatId) {
                const updateRes = await saveChatFunc(chatId, updateChatData);
                baseChat = updateRes?.data;
            } else if (createdChatId) {
                const patchRes = await ChatService.updateChat(createdChatId, updateChatData);
                baseChat = patchRes?.data;
            }

            if (!baseChat?.chat_id) {
                throw new Error("Failed to save chat.");
            }

            let finalChat = baseChat;
            if (selectedAvatarFile && avatarImageSize) {
                try {
                    finalChat = await uploadAndSetAvatar(baseChat.chat_id) || baseChat;
                    clearPendingAvatarSelection();
                } catch (avatarUploadError) {
                    setSavedChat(baseChat);
                    if (onSaved) {
                        onSaved(baseChat);
                    }
                    setAvatarError(
                        avatarUploadError?.response?.data?.detail
                        || avatarUploadError?.message
                        || "Chat created, but avatar upload failed. You can retry.",
                    );
                    return;
                }
            }

            setSavedChat(finalChat);
            if (setTitle && finalChat.title) {
                setTitle(finalChat.title);
            }
            if (onSaved) {
                onSaved(finalChat);
            }
            setActive(false);
        } catch (error) {
            setFormError(error?.response?.data?.detail || "Failed to save chat.");
        } finally {
            setIsLoadingSaveChat(false);
        }
    };

    const handleDeleteAvatar = async () => {
        setAvatarError("");

        if (selectedAvatarFile) {
            clearPendingAvatarSelection();
            return;
        }

        if (!effectiveChatId || !effectiveAvatar) {
            return;
        }

        setIsAvatarActionLoading(true);
        try {
            const res = await ChatService.deleteChatAvatar(effectiveChatId);
            setSavedChat(res.data);
            if (onSaved) {
                onSaved(res.data);
            }
        } catch (error) {
            setAvatarError(error?.response?.data?.detail || "Failed to delete chat avatar.");
        } finally {
            setIsAvatarActionLoading(false);
        }
    };

    const avatarViewportStyle = useMemo(() => {
        const avatarImageSizeForRender = avatarImageSize || {
            width: CHAT_AVATAR_VIEWPORT_SIZE,
            height: CHAT_AVATAR_VIEWPORT_SIZE,
        };
        const rendered = getRenderedSize(
            avatarImageSizeForRender,
            avatarCropScale,
            CHAT_AVATAR_VIEWPORT_SIZE,
        );
        return {
            transform: `translate(${avatarCropOffset.x}px, ${avatarCropOffset.y}px)`,
            width: `${rendered.width}px`,
            height: `${rendered.height}px`,
        };
    }, [avatarCropOffset.x, avatarCropOffset.y, avatarCropScale, avatarImageSize]);

    const avatarPreviewSrc = avatarPreview
        || effectiveAvatar?.medium_url
        || effectiveAvatar?.small_url
        || "/assets/chat.svg";

    return (
        <Modal active={active} setActive={closeModal}>
            <form id="save-chat-form" onSubmit={handleSaveChat}>
                <h1>{modalHeader}</h1>

                {isGroupChat && (
                <div className="chat-avatar-picker">
                    <button
                        type="button"
                        className="chat-avatar-trigger"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoadingSaveChat || isAvatarActionLoading}
                    >
                        <img
                            src={avatarPreviewSrc}
                            alt="Chat avatar preview"
                            onError={(event) => {
                                event.currentTarget.src = "/assets/chat.svg";
                            }}
                        />
                        <span>{selectedAvatarFile ? "Image selected" : "Choose avatar"}</span>
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        className="chat-avatar-file-input"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleSelectAvatar}
                    />

                    {selectedAvatarFile && avatarPreview && (
                        <>
                            <div className="chat-avatar-crop-toolbar">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isLoadingSaveChat || isAvatarActionLoading}
                                >
                                    Change image
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={resetAvatarCrop}
                                    disabled={!avatarImageSize || isLoadingSaveChat || isAvatarActionLoading}
                                >
                                    Reset crop
                                </button>
                            </div>

                            <div
                                className="chat-avatar-crop-viewport"
                                onPointerDown={handleAvatarPointerDown}
                                onPointerMove={handleAvatarPointerMove}
                                onPointerUp={handleAvatarPointerUp}
                                onPointerCancel={handleAvatarPointerUp}
                            >
                                <img
                                    src={avatarPreview}
                                    alt="Chat avatar crop source"
                                    className="chat-avatar-crop-image"
                                    onLoad={handleAvatarPreviewLoad}
                                    draggable={false}
                                    style={avatarViewportStyle}
                                />
                                <div className="chat-avatar-crop-overlay" />
                            </div>

                            <label className="chat-avatar-zoom-control">
                                <span>Zoom {avatarCropScale.toFixed(2)}x</span>
                                <input
                                    className="chat-avatar-zoom-slider"
                                    type="range"
                                    min="1"
                                    max={String(CHAT_AVATAR_MAX_ZOOM)}
                                    step="0.01"
                                    value={avatarCropScale}
                                    onChange={handleAvatarZoomChange}
                                    style={{ "--zoom-fill": `${avatarZoomFillPercent}%` }}
                                />
                            </label>
                        </>
                    )}

                    {(selectedAvatarFile || effectiveAvatar) && (
                        <button
                            type="button"
                            className="btn btn-danger chat-avatar-delete"
                            onClick={handleDeleteAvatar}
                            disabled={isAvatarActionLoading || isLoadingSaveChat}
                        >
                            {isAvatarActionLoading ? <Loader /> : "Remove avatar"}
                        </button>
                    )}

                    {avatarError && <p className="chat-avatar-error">{avatarError}</p>}
                </div>
                )}

                <input
                    type="text"
                    placeholder="Chat title"
                    value={chatTitle}
                    onChange={(event) => setChatTitle(event.target.value)}
                    maxLength={64}
                />

                <div className="chat-private">
                    <input
                        type="checkbox"
                        id="private"
                        name="private"
                        value="1"
                        checked={chatIsPrivate}
                        onChange={(event) => setChatIsPrivate(event.target.checked)}
                    />
                    <label htmlFor="private" className="chat">Private</label>
                </div>

                {canEditMembers && (
                    <div className="chat-members-picker">
                        <input
                            type="text"
                            placeholder="Search users"
                            value={memberQuery}
                            onChange={(event) => setMemberQuery(event.target.value)}
                        />

                        {selectedMembers.length > 0 && (
                            <div className="selected-members">
                                {selectedMembers.map((member) => (
                                    <button
                                        key={member.user_id}
                                        type="button"
                                        className="selected-member"
                                        onClick={() => removeMember(member.user_id)}
                                    >
                                        {member.username}
                                    </button>
                                ))}
                            </div>
                        )}

                        {(isLoadingMembers || memberResults.length > 0) && (
                            <div className="member-results">
                                {isLoadingMembers && <div className="member-result muted">Searching...</div>}
                                {!isLoadingMembers && memberResults.map((user) => (
                                    <button
                                        key={user.user_id}
                                        type="button"
                                        className="member-result"
                                        onClick={() => addMember(user)}
                                        disabled={selectedMembers.some((member) => member.user_id === user.user_id)}
                                    >
                                        {user.username}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {formError && <p className="chat-form-error">{formError}</p>}

                <button
                    className="btn btn-primary btn-block"
                    disabled={chatTitle.trim().length < 1 || isLoadingSaveChat || isAvatarActionLoading}
                    type="submit"
                >
                    {isLoadingSaveChat ? <Loader /> : buttonText}
                </button>
            </form>
        </Modal>
    );
}


export default ChatModal;
