import MediaViewer, { normalizeAttachmentListToMediaViewerItems } from "../media-viewer";


function PostGalleryViewer({ attachments = [], activeIndex, onClose, onChange }) {
    const items = normalizeAttachmentListToMediaViewerItems(attachments);
    const isOpen = activeIndex !== null && activeIndex >= 0 && items.length > 0;
    const safeIndex = Math.min(Math.max(activeIndex || 0, 0), Math.max(items.length - 1, 0));

    return (
        <MediaViewer
            open={isOpen}
            items={items}
            activeIndex={safeIndex}
            onClose={onClose}
            onIndexChange={onChange}
            ariaLabel="Post gallery"
            videoSkin="post"
        />
    );
}

export default PostGalleryViewer;
