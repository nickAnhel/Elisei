import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import "./ArticleRenderer.css";

import { buildArticleAssetLookup, buildArticleVideoLookup, buildMermaidPreviewUrl, parseArticleMarkdown, slugifyHeading } from "../../utils/articleMarkdown";
import { formatVideoTime } from "../video-player/utils/time";
import { getUserDisplayName } from "../../utils/userDisplay";
import { normalizeAttachmentToMediaViewerItem } from "../media-viewer";
import VideoPlayer from "../video-player";


function MarkdownBlock({ content }) {
    if (!content?.trim()) {
        return null;
    }

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h2({ children, ...props }) {
                    const text = Array.isArray(children) ? children.join("") : String(children || "");
                    return <h2 id={slugifyHeading(text)} {...props}>{children}</h2>;
                },
                h3({ children, ...props }) {
                    const text = Array.isArray(children) ? children.join("") : String(children || "");
                    return <h3 id={slugifyHeading(text)} {...props}>{children}</h3>;
                },
                code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                        <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: "1rem" }}
                            {...props}
                        >
                            {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                    ) : (
                        <code className={className} {...props}>
                            {children}
                        </code>
                    );
                },
                a({ href, children, ...props }) {
                    const normalizedHref = String(href || "").trim();
                    const isExternal = /^(https?:)?\/\//i.test(normalizedHref);
                    return (
                        <a
                            href={normalizedHref || "#"}
                            target={isExternal ? "_blank" : undefined}
                            rel={isExternal ? "noreferrer" : undefined}
                            {...props}
                        >
                            {children}
                        </a>
                    );
                },
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

function buildVideoSources(asset) {
    const sourceUrl = asset?.stream_url || asset?.original_url;
    if (!sourceUrl) {
        return [];
    }

    return [{
        id: "original",
        label: "Original",
        src: sourceUrl,
        mimeType: asset.mime_type || asset.declared_mime_type || "",
        isOriginal: true,
    }];
}

function buildArticleMediaItems(assetLookup) {
    return Object.values(assetLookup)
        .filter((asset) => (
            asset
            && (asset.asset_type === "image" || asset.asset_type === "video" || asset.file_kind === "image" || asset.file_kind === "video")
            && (asset.original_url || asset.preview_url || asset.stream_url)
        ))
        .map((asset) => normalizeAttachmentToMediaViewerItem(asset));
}

function PlatformVideoBlock({ block, video, renderMode }) {
    if (!video) {
        return (
            <div className={renderMode === "editor" ? "article-pending-asset" : "article-missing-asset"}>
                {renderMode === "editor" ? "Loading video preview..." : "Embedded video is unavailable."}
            </div>
        );
    }

    const previewUrl = video.cover?.preview_url || video.cover?.original_url;
    const publishedLabel = new Date(video.published_at || video.created_at).toLocaleDateString();
    const durationLabel = video.duration_seconds ? formatVideoTime(video.duration_seconds) : "";
    const canPlayInline = video.processing_status === "ready" && Array.isArray(video.playback_sources) && video.playback_sources.length > 0;

    return (
        <figure className={`article-platform-video-block ${block.attrs.size || "wide"}`}>
            <div className="article-platform-video-card">
                {
                    canPlayInline
                        ? (
                            <VideoPlayer
                                skin="article"
                                sources={video.playback_sources}
                                posterUrl={previewUrl || undefined}
                                title={video.title || "Embedded video"}
                                chapters={video.chapters || []}
                                preload="metadata"
                            />
                        ) : (
                            <Link to={video.canonical_path} className="article-platform-video-link">
                                <div className={`article-platform-video-preview ${video.orientation || ""}`}>
                                    {
                                        previewUrl
                                            ? <img src={previewUrl} alt={video.title || "Embedded video preview"} />
                                            : <div className="article-platform-video-preview-empty">Preview unavailable</div>
                                    }
                                    <span className="article-platform-video-play">Open video</span>
                                    {
                                        durationLabel &&
                                        <span className="article-platform-video-duration">{durationLabel}</span>
                                    }
                                </div>
                            </Link>
                        )
                }
                <div className="article-platform-video-body">
                    <div className="article-platform-video-meta">
                        <span>{getUserDisplayName(video.user, video.user?.username || "Unknown")}</span>
                        <span>{publishedLabel}</span>
                        {durationLabel ? <span>{durationLabel}</span> : null}
                    </div>
                    <div className="article-platform-video-heading">
                        <strong>{video.title || "Untitled video"}</strong>
                        <Link to={video.canonical_path} className="article-platform-video-page-link">
                            Open
                        </Link>
                    </div>
                    {
                        video.excerpt &&
                        <p>{video.excerpt}</p>
                    }
                </div>
            </div>
            {
                (block.attrs.caption || video.processing_status !== "ready") &&
                <figcaption>
                    {block.attrs.caption || `Video status: ${video.processing_status}`}
                </figcaption>
            }
        </figure>
    );
}

function ArticleRenderer({
    bodyMarkdown,
    article = null,
    extraAssets = [],
    extraVideos = [],
    renderMode = "default",
    onEditMermaid = null,
    onMediaOpen = null,
}) {
    const blocks = parseArticleMarkdown(bodyMarkdown || "");
    const assetLookup = buildArticleAssetLookup(article, extraAssets);
    const videoLookup = buildArticleVideoLookup(article, extraVideos);
    const mediaViewerItems = buildArticleMediaItems(assetLookup);
    let mermaidIndex = -1;

    return (
        <div className="article-renderer">
            {
                blocks.map((block, index) => {
                    if (block.type === "markdown") {
                        return <MarkdownBlock key={`markdown-${index}`} content={block.content} />;
                    }

                    if (block.type === "spoiler") {
                        return (
                            <details className="article-spoiler" key={`spoiler-${index}`}>
                                <summary>{block.title || "Spoiler"}</summary>
                                <ArticleRenderer
                                    bodyMarkdown={block.bodyMarkdown}
                                    article={article}
                                    extraAssets={extraAssets}
                                    extraVideos={extraVideos}
                                    renderMode={renderMode}
                                    onEditMermaid={onEditMermaid}
                                    onMediaOpen={onMediaOpen}
                                />
                            </details>
                        );
                    }

                    if (block.type === "image") {
                        const asset = assetLookup[block.attrs["asset-id"]];
                        if (!asset) {
                            return (
                                <div
                                    className={renderMode === "editor" ? "article-pending-asset" : "article-missing-asset"}
                                    key={`image-${index}`}
                                >
                                    {renderMode === "editor" ? "Loading image preview..." : `Missing image asset: ${block.attrs["asset-id"]}`}
                                </div>
                            );
                        }

                        return (
                            <figure className={`article-figure ${block.attrs.size || "wide"}`} key={`image-${index}`}>
                                {
                                    onMediaOpen
                                        ? (
                                            <button
                                                type="button"
                                                className="article-media-open-button"
                                                onClick={() => onMediaOpen({
                                                    item: normalizeAttachmentToMediaViewerItem(asset),
                                                    items: mediaViewerItems,
                                                })}
                                                aria-label={`Open ${block.attrs.caption || asset.original_filename || "article image"} in viewer`}
                                            >
                                                <img
                                                    src={asset.original_url || asset.preview_url}
                                                    alt={block.attrs.caption || asset.original_filename || "Article image"}
                                                />
                                            </button>
                                        ) : (
                                            <img
                                                src={asset.original_url || asset.preview_url}
                                                alt={block.attrs.caption || asset.original_filename || "Article image"}
                                            />
                                        )
                                }
                                {block.attrs.caption && <figcaption>{block.attrs.caption}</figcaption>}
                            </figure>
                        );
                    }

                    if (block.type === "video") {
                        const asset = assetLookup[block.attrs["asset-id"]];
                        if (!asset) {
                            return (
                                <div
                                    className={renderMode === "editor" ? "article-pending-asset" : "article-missing-asset"}
                                    key={`video-${index}`}
                                >
                                    {renderMode === "editor" ? "Loading video preview..." : `Missing video asset: ${block.attrs["asset-id"]}`}
                                </div>
                            );
                        }

                        return (
                            <figure className={`article-video-block ${block.attrs.size || "wide"}`} key={`video-${index}`}>
                                <VideoPlayer
                                    skin="article"
                                    sources={buildVideoSources(asset)}
                                    posterUrl={asset.poster_url || undefined}
                                    title={block.attrs.caption || asset.original_filename || "Article video"}
                                    preload="metadata"
                                />
                                {
                                    onMediaOpen &&
                                    <button
                                        type="button"
                                        className="article-video-open-button"
                                        onClick={() => onMediaOpen({
                                            item: normalizeAttachmentToMediaViewerItem(asset),
                                            items: mediaViewerItems,
                                        })}
                                    >
                                        Open in viewer
                                    </button>
                                }
                                {block.attrs.caption && <figcaption>{block.attrs.caption}</figcaption>}
                            </figure>
                        );
                    }

                    if (block.type === "youtube") {
                        const embedUrl = `https://www.youtube.com/embed/${block.attrs.id}`;
                        return (
                            <figure className="article-youtube-block" key={`youtube-${index}`}>
                                <div className="article-youtube-frame">
                                    <iframe
                                        src={embedUrl}
                                        title={block.attrs.title || "YouTube video"}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                                {block.attrs.title && <figcaption>{block.attrs.title}</figcaption>}
                            </figure>
                        );
                    }

                    if (block.type === "platform_video") {
                        const video = videoLookup[block.attrs["video-id"]];
                        return (
                            <PlatformVideoBlock
                                key={`platform-video-${index}`}
                                block={block}
                                video={video}
                                renderMode={renderMode}
                            />
                        );
                    }

                    if (block.type === "mermaid") {
                        mermaidIndex += 1;
                        const previewUrl = buildMermaidPreviewUrl(block.code);
                        return (
                            <figure className="article-mermaid-block" key={`mermaid-${index}`}>
                                <div className="article-mermaid-header">
                                    <div className="article-mermaid-label">Mermaid diagram</div>
                                    {
                                        renderMode === "editor" && onEditMermaid &&
                                        <button
                                            type="button"
                                            className="article-mermaid-edit-button"
                                            onClick={() => onEditMermaid({ code: block.code, index: mermaidIndex })}
                                        >
                                            Edit
                                        </button>
                                    }
                                </div>
                                {
                                    previewUrl
                                        ? (
                                            <img
                                                className="article-mermaid-image"
                                                src={previewUrl}
                                                alt="Mermaid diagram"
                                                onError={(event) => {
                                                    event.currentTarget.style.display = "none";
                                                    event.currentTarget.nextElementSibling?.classList.add("visible");
                                                }}
                                            />
                                        )
                                        : null
                                }
                                <pre className={`article-mermaid-code ${previewUrl ? "" : "visible"}`}>{block.code}</pre>
                            </figure>
                        );
                    }

                    return null;
                })
            }
        </div>
    );
}

export default ArticleRenderer;
