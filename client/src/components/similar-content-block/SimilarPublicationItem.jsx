import { Link } from "react-router-dom";

import "./SimilarPublicationItem.css";

import TagChip from "../tag-chip/TagChip";
import { getAvatarUrl } from "../../utils/avatar";
import { getUserDisplayName } from "../../utils/userDisplay";


function SimilarPublicationItem({ item }) {
    if (!item) {
        return null;
    }

    const authorName = getUserDisplayName(item.user, item.user?.username || "Unknown user");
    const authorPath = item.user?.username ? `/people/@${item.user.username}` : null;
    const publishedDate = item.published_at || item.created_at;
    const publishedLabel = publishedDate ? new Date(publishedDate).toLocaleDateString() : "Unknown date";
    const canonicalPath = getCanonicalPath(item);
    const previewUrl = getPreviewUrl(item);
    const title = getTitle(item);

    return (
        <article className="similar-publication-item">
            <div className="similar-publication-item-meta">
                {
                    authorPath
                        ? (
                            <Link to={authorPath} className="similar-publication-item-author">
                                <img src={getAvatarUrl(item.user, "small")} alt={`${authorName} profile`} />
                                <span>{authorName}</span>
                            </Link>
                        )
                        : (
                            <div className="similar-publication-item-author">
                                <img src="/assets/profile.svg" alt={`${authorName} profile`} />
                                <span>{authorName}</span>
                            </div>
                        )
                }
                <span className="similar-publication-item-date">{publishedLabel}</span>
            </div>

            {
                canonicalPath
                    ? (
                        <Link to={canonicalPath} className="similar-publication-item-preview">
                            {
                                previewUrl
                                    ? <img src={previewUrl} alt={title} />
                                    : <div className="similar-publication-item-preview-empty">No preview</div>
                            }
                        </Link>
                    )
                    : (
                        <div className="similar-publication-item-preview">
                            {
                                previewUrl
                                    ? <img src={previewUrl} alt={title} />
                                    : <div className="similar-publication-item-preview-empty">No preview</div>
                            }
                        </div>
                    )
            }

            {
                canonicalPath
                    ? <Link to={canonicalPath} className="similar-publication-item-title">{title}</Link>
                    : <p className="similar-publication-item-title">{title}</p>
            }

            {
                item.tags?.length > 0 &&
                <div className="similar-publication-item-tags">
                    {
                        item.tags.slice(0, 4).map((tag) => (
                            <TagChip key={tag.tag_id || tag.slug} slug={tag.slug} />
                        ))
                    }
                </div>
            }
        </article>
    );
}

function getCanonicalPath(item) {
    if (item.canonical_path) {
        return item.canonical_path;
    }

    if (item.content_type === "article") {
        return `/articles/${item.article_id || item.content_id}`;
    }

    if (item.content_type === "video") {
        return `/videos/${item.video_id || item.content_id}`;
    }

    if (item.content_type === "moment") {
        return `/moments?moment=${item.moment_id || item.content_id}`;
    }

    return `/posts/${item.post_id || item.content_id}`;
}

function getPreviewUrl(item) {
    if (item.content_type === "article") {
        return item.cover?.preview_url || item.cover?.original_url || "";
    }

    if (item.content_type === "video") {
        return item.cover?.preview_url || item.cover?.original_url || "";
    }

    if (item.content_type === "moment") {
        return item.cover?.poster_url || item.cover?.preview_url || item.cover?.original_url || "";
    }

    const firstMedia = item.media_attachments?.[0];
    return firstMedia?.preview_url || firstMedia?.original_url || "";
}

function getTitle(item) {
    if (item.title?.trim()) {
        return item.title.trim();
    }

    if (item.content_type === "post") {
        const rawText = (item.post_content || item.content || "").replace(/\s+/g, " ").trim();
        if (rawText.length === 0) {
            return "Post publication";
        }
        return rawText.length > 84 ? `${rawText.slice(0, 84)}...` : rawText;
    }

    if (item.content_type === "moment") {
        return item.caption || "Moment publication";
    }

    return "Untitled publication";
}

export default SimilarPublicationItem;
