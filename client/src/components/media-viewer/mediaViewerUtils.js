export function buildVideoSourcesFromItem(item) {
    if (Array.isArray(item?.sources) && item.sources.length > 0) {
        return item.sources;
    }

    const sourceUrl = item?.originalUrl || item?.previewUrl;
    if (!sourceUrl) {
        return [];
    }

    return [{
        id: item.id || "original",
        label: "Original",
        src: sourceUrl,
        mimeType: item.mimeType || "",
        isOriginal: true,
    }];
}

export function normalizeAttachmentToMediaViewerItem(attachment) {
    const type = attachment?.asset_type === "video" || attachment?.file_kind === "video" ? "video" : "image";
    const previewUrl = attachment?.preview_url || attachment?.original_url || attachment?.stream_url || "";
    const originalUrl = attachment?.original_url || attachment?.stream_url || attachment?.preview_url || "";

    return {
        id: attachment?.asset_id || `${attachment?.position || 0}-${attachment?.original_filename || "media"}`,
        type,
        title: attachment?.original_filename || (type === "video" ? "Video" : "Image"),
        previewUrl,
        originalUrl,
        downloadUrl: attachment?.download_url || originalUrl,
        posterUrl: attachment?.poster_url || "",
        mimeType: attachment?.mime_type || "",
        sources: type === "video"
            ? [{
                id: attachment?.asset_id || "video-source",
                label: "Source",
                src: attachment?.stream_url || attachment?.original_url || attachment?.preview_url || "",
                mimeType: attachment?.mime_type || "",
                isOriginal: true,
            }]
            : [],
    };
}

export function normalizeAttachmentListToMediaViewerItems(attachments = []) {
    return attachments
        .filter((attachment) => (
            attachment
            && (attachment.asset_type === "image" || attachment.asset_type === "video" || attachment.file_kind === "image" || attachment.file_kind === "video")
            && (attachment.preview_url || attachment.original_url || attachment.stream_url)
        ))
        .map(normalizeAttachmentToMediaViewerItem);
}

export function findMediaViewerIndexByAttachment(items, attachment) {
    if (!attachment) {
        return 0;
    }

    const byAssetId = items.findIndex((item) => item.id && attachment.asset_id && item.id === attachment.asset_id);
    if (byAssetId >= 0) {
        return byAssetId;
    }

    const byTitle = items.findIndex((item) => item.title && item.title === attachment.original_filename);
    if (byTitle >= 0) {
        return byTitle;
    }

    return 0;
}
