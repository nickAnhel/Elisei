import { useContext, useEffect, useState } from "react"
import { Link } from "react-router-dom";

import "./Message.css";

import { StoreContext } from "../..";
import DownloadIcon from "../icons/DownloadIcon";
import FileTypeIcon from "../icons/FileTypeIcon";
import { getAvatarUrl } from "../../utils/avatar";
import { formatAttachmentSize } from "../../utils/postAttachments";
import { getMessageReactionMeta } from "./messageReactions";
import { getUserDisplayName } from "../../utils/userDisplay";
import VideoPlayer from "../video-player";


function Message({
    messageId,
    username,
    profileUsername = null,
    content,
    createdAt,
    avatarUrl = null,
    status = "sent",
    editedAt = null,
    deletedAt = null,
    replyPreview = null,
    attachments = [],
    sharedContent = null,
    reactions = [],
    isHighlighted = false,
    showUsername = true,
    onAttachmentOpen,
    onContextMenu,
    onReplyPreviewClick,
    onRetry,
}) {
    const { store } = useContext(StoreContext);

    const createdAtTimeLocal = createdAt
        ? new Date(createdAt).toLocaleTimeString().split(":").slice(0, 2).join(":")
        : "";
    const [userProfilePhotoSrc, setUserProfilePhotoSrc] = useState(
        avatarUrl || (username === "You" ? getAvatarUrl(store.user, "small") : "/assets/profile.svg")
    );

    useEffect(() => {
        setUserProfilePhotoSrc(
            avatarUrl || (username === "You" ? getAvatarUrl(store.user, "small") : "/assets/profile.svg")
        );
    }, [avatarUrl, store.user, username]);

    const isOwnMessage = username === "You";
    const isDeleted = Boolean(deletedAt);
    const visibleContent = isDeleted ? "Message deleted" : content;
    const visibleReactions = reactions.filter((reaction) => reaction.count > 0 || reaction.reactedByMe);
    const profilePath = isOwnMessage
        ? `/people/@${store.user.username}`
        : (profileUsername ? `/people/@${profileUsername}` : "/people");

    return (
        <>
            <div
                id={messageId ? `message-${messageId}` : undefined}
                className={`${isOwnMessage ? "msg you" : "msg"} ${status !== "sent" ? `msg-${status}` : ""} ${isDeleted ? "msg-deleted" : ""} ${isHighlighted ? "msg-highlighted" : ""}`}
                onContextMenu={onContextMenu}
            >
                <Link className="msg-avatar-link" to={profilePath}>
                    <img
                        src={userProfilePhotoSrc}
                        onError={() => { setUserProfilePhotoSrc("/assets/profile.svg") }}
                        alt={username}
                    />
                </Link>
                <div className="msg-info">
                    <div className="msg-label">
                        <div className="username">
                            {showUsername && !isOwnMessage ? username : ""}
                        </div>
                        <div className="msg-time-meta">
                            {status === "pending" ? "Sending" : status === "failed" ? "Failed" : createdAtTimeLocal}
                            {!isDeleted && editedAt && " edited"}
                        </div>
                    </div>
                    {
                        replyPreview &&
                        <button
                            className={`msg-reply-preview ${replyPreview.deleted ? "msg-reply-preview-deleted" : ""}`}
                            type="button"
                            onClick={() => onReplyPreviewClick?.(replyPreview.messageId)}
                        >
                            <span>{replyPreview.senderDisplayName}</span>
                            <p>{replyPreview.contentPreview}</p>
                        </button>
                    }
                    {visibleContent && <div className="msg-text">{visibleContent}</div>}
                    {!isDeleted && attachments.length > 0 && (
                        <MessageAttachments attachments={attachments} onAttachmentOpen={onAttachmentOpen} />
                    )}
                    {!isDeleted && sharedContent && (
                        <MessageSharedContentPreview content={sharedContent} />
                    )}
                    {visibleReactions.length > 0 && (
                        <MessageReactions reactions={visibleReactions} />
                    )}
                    {
                        status === "failed" && !isDeleted &&
                        <button className="msg-retry" type="button" onClick={onRetry}>Retry</button>
                    }
                </div>
            </div>
        </>
    )
}

function MessageReactions({ reactions = [] }) {
    return (
        <div className="msg-reactions" aria-label="Message reactions">
            {reactions.map((reaction) => {
                const meta = getMessageReactionMeta(reaction.reactionType);

                return (
                    <span
                        key={reaction.reactionType}
                        className={`msg-reaction-pill ${reaction.reactedByMe ? "msg-reaction-pill-active" : ""}`}
                        aria-label={`${meta.ariaLabel} ${reaction.count}`}
                    >
                        <span className="msg-reaction-pill-emoji" aria-hidden="true">
                            {meta.emoji}
                        </span>
                        <span className="msg-reaction-pill-count">{reaction.count}</span>
                    </span>
                );
            })}
        </div>
    );
}

function MessageSharedContentPreview({ content }) {
    if (content.is_available === false) {
        return (
            <div className="msg-shared-content msg-shared-content-unavailable" aria-label="Shared content unavailable">
                <span className="msg-shared-content-body">
                    <span className="msg-shared-content-type">Content unavailable</span>
                    <span className="msg-shared-content-title">
                        {content.unavailable_message || "You can't view this content"}
                    </span>
                </span>
            </div>
        );
    }

    const path = resolveContentPath(content);
    const imageUrl = resolveContentImage(content);
    const title = content.title || resolveContentTypeLabel(content.content_type);
    const body = content.excerpt || content.description || content.caption || content.post_content || "";

    return (
        <Link className="msg-shared-content" to={path}>
            {imageUrl && (
                <img
                    className="msg-shared-content-image"
                    src={imageUrl}
                    alt={title}
                />
            )}
            <span className="msg-shared-content-body">
                <span className="msg-shared-content-type">{resolveContentTypeLabel(content.content_type)}</span>
                <span className="msg-shared-content-title">{title}</span>
                {body && <span className="msg-shared-content-excerpt">{body}</span>}
                {content.user && (
                    <span className="msg-shared-content-author">{getUserDisplayName(content.user, "Unknown")}</span>
                )}
            </span>
        </Link>
    );
}

function resolveContentImage(content) {
    if (content.cover?.preview_url || content.cover?.poster_url || content.cover?.original_url) {
        return content.cover.preview_url || content.cover.poster_url || content.cover.original_url;
    }

    const firstMedia = content.media_attachments?.[0];
    return firstMedia?.preview_url || firstMedia?.original_url || null;
}

function resolveContentPath(content) {
    if (content.canonical_path) {
        return content.canonical_path;
    }
    if (content.content_type === "post") {
        return `/feed?p=${content.content_id}`;
    }
    if (content.content_type === "article") {
        return `/articles/${content.content_id}`;
    }
    if (content.content_type === "video") {
        return `/videos/${content.content_id}`;
    }
    if (content.content_type === "moment") {
        return `/moments?moment=${content.content_id}`;
    }
    return "/feed";
}

function resolveContentTypeLabel(contentType) {
    const labels = {
        post: "Post",
        article: "Article",
        video: "Video",
        moment: "Moment",
    };
    return labels[contentType] || "Content";
}

function MessageAttachments({ attachments = [], onAttachmentOpen }) {
    const mediaAttachments = attachments.filter((attachment) => {
        const isImage = attachment.asset_type === "image" || attachment.file_kind === "image";
        const isVideo = attachment.asset_type === "video" || attachment.file_kind === "video";
        return isImage || isVideo;
    });

    return (
        <div className="msg-attachments">
            {attachments.map((attachment) => {
                const key = `${attachment.asset_id}-${attachment.position}`;
                const isImage = attachment.asset_type === "image" || attachment.file_kind === "image";
                const isVideo = attachment.asset_type === "video" || attachment.file_kind === "video";
                const mediaUrl = attachment.preview_url || attachment.original_url || attachment.stream_url;
                const videoSource = attachment.stream_url || attachment.original_url || mediaUrl;
                const metaParts = [
                    attachment.file_kind?.toUpperCase() || "FILE",
                    formatAttachmentSize(attachment.size_bytes),
                ].filter(Boolean);

                if (isImage && mediaUrl) {
                    return (
                        <button
                            key={key}
                            type="button"
                            className="msg-attachment-media"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onAttachmentOpen?.(attachment, mediaAttachments);
                            }}
                            aria-label={`Open ${attachment.original_filename || "image"} in media viewer`}
                        >
                            <img src={mediaUrl} alt={attachment.original_filename || "Image attachment"} />
                        </button>
                    );
                }

                if (isVideo && videoSource) {
                    return (
                        <div key={key} className="msg-attachment-video">
                            <VideoPlayer
                                skin="chat"
                                title={attachment.original_filename || "Video attachment"}
                                posterUrl={attachment.poster_url || undefined}
                                sources={[
                                    {
                                        id: attachment.asset_id || key,
                                        label: "Source",
                                        src: videoSource,
                                        mimeType: attachment.mime_type || undefined,
                                    },
                                ]}
                            />
                            <button
                                type="button"
                                className="msg-attachment-open-media"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onAttachmentOpen?.(attachment, mediaAttachments);
                                }}
                            >
                                Open in viewer
                            </button>
                        </div>
                    );
                }

                return (
                    <div key={key} className="msg-attachment-file">
                        <span className="msg-attachment-file-icon" aria-hidden="true">
                            <FileTypeIcon kind={attachment.file_kind} />
                        </span>
                        <span className="msg-attachment-file-body">
                            <span className="msg-attachment-file-name">
                                {attachment.original_filename || "Untitled file"}
                            </span>
                            {metaParts.length > 0 && (
                                <span className="msg-attachment-file-meta">{metaParts.join(" . ")}</span>
                            )}
                        </span>
                        {attachment.download_url && (
                            <a
                                className="msg-attachment-download"
                                href={attachment.download_url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Download ${attachment.original_filename || "file"}`}
                                onClick={(event) => event.stopPropagation()}
                            >
                                <DownloadIcon />
                            </a>
                        )}
                    </div>
                );
        })}
    </div>
);
}

export default Message
