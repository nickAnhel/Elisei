import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import "./MediaViewer.css";

import ChevronIcon from "../icons/ChevronIcon";
import CloseIcon from "../icons/CloseIcon";
import VideoPlayer from "../video-player";
import { buildVideoSourcesFromItem } from "./mediaViewerUtils";


function MediaViewer({
    open,
    items = [],
    activeIndex = 0,
    onClose,
    onIndexChange,
    ariaLabel = "Media viewer",
    videoSkin = "page",
}) {
    const containerRef = useRef(null);
    const previousFocusRef = useRef(null);
    const swipeRef = useRef({ startX: null });

    const hasItems = items.length > 0;
    const safeIndex = Math.min(Math.max(activeIndex || 0, 0), Math.max(items.length - 1, 0));
    const currentItem = hasItems ? items[safeIndex] : null;
    const hasMultipleItems = items.length > 1;

    const canShow = Boolean(open && currentItem);

    const handlePrevious = useMemo(() => (() => {
        if (!hasMultipleItems) {
            return;
        }
        onIndexChange?.((safeIndex - 1 + items.length) % items.length);
    }), [hasMultipleItems, items.length, onIndexChange, safeIndex]);

    const handleNext = useMemo(() => (() => {
        if (!hasMultipleItems) {
            return;
        }
        onIndexChange?.((safeIndex + 1) % items.length);
    }), [hasMultipleItems, items.length, onIndexChange, safeIndex]);

    useEffect(() => {
        if (!canShow) {
            return undefined;
        }

        previousFocusRef.current = document.activeElement;
        containerRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose?.();
                return;
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                handlePrevious();
                return;
            }

            if (event.key === "ArrowRight") {
                event.preventDefault();
                handleNext();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);

            const previousFocus = previousFocusRef.current;
            if (previousFocus && typeof previousFocus.focus === "function") {
                previousFocus.focus();
            }
        };
    }, [canShow, handleNext, handlePrevious, onClose]);

    if (!canShow || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div
            className="media-viewer-overlay"
            onClick={() => onClose?.()}
            role="presentation"
        >
            <div
                ref={containerRef}
                className="media-viewer"
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                    swipeRef.current.startX = event.clientX;
                }}
                onPointerUp={(event) => {
                    if (!hasMultipleItems || swipeRef.current.startX == null) {
                        swipeRef.current.startX = null;
                        return;
                    }

                    const deltaX = event.clientX - swipeRef.current.startX;
                    swipeRef.current.startX = null;

                    if (Math.abs(deltaX) < 45) {
                        return;
                    }

                    if (deltaX > 0) {
                        handlePrevious();
                    } else {
                        handleNext();
                    }
                }}
            >
                <div className="media-viewer-toolbar">
                    <div className="media-viewer-meta">
                        <span className="media-viewer-counter">{safeIndex + 1} / {items.length}</span>
                        <span className="media-viewer-title">{currentItem.title || "Media"}</span>
                    </div>
                    <div className="media-viewer-actions">
                        {currentItem.originalUrl && (
                            <a
                                href={currentItem.originalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="media-viewer-link-action"
                            >
                                Open original
                            </a>
                        )}
                        {currentItem.downloadUrl && (
                            <a
                                href={currentItem.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="media-viewer-link-action"
                                download
                            >
                                Download
                            </a>
                        )}
                        <button type="button" className="media-viewer-close" onClick={() => onClose?.()} aria-label="Close viewer">
                            <CloseIcon />
                        </button>
                    </div>
                </div>

                <div className="media-viewer-frame">
                    <button
                        type="button"
                        className="media-viewer-nav"
                        aria-label="Previous media"
                        onClick={handlePrevious}
                        disabled={!hasMultipleItems}
                    >
                        <ChevronIcon direction="left" />
                    </button>

                    <div className="media-viewer-content">
                        {currentItem.type === "video" ? (
                            <VideoPlayer
                                skin={videoSkin}
                                title={currentItem.title || "Video"}
                                posterUrl={currentItem.posterUrl || undefined}
                                sources={buildVideoSourcesFromItem(currentItem)}
                                preload="metadata"
                            />
                        ) : (
                            <img
                                src={currentItem.originalUrl || currentItem.previewUrl}
                                alt={currentItem.title || "Media"}
                            />
                        )}
                    </div>

                    <button
                        type="button"
                        className="media-viewer-nav"
                        aria-label="Next media"
                        onClick={handleNext}
                        disabled={!hasMultipleItems}
                    >
                        <ChevronIcon direction="right" />
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

export default MediaViewer;
