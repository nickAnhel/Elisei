import { useState } from "react";
import { createPortal } from "react-dom";

import "./MarkdownToolbar.css";

import { applyActionToValue } from "../../utils/markdownFormatting";
import { getMarkdownToolbarPreset } from "./markdownToolbarPresets";

function MarkdownToolbarIcon({ icon }) {
    const commonProps = {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
    };

    switch (icon) {
    case "bold":
        return <svg {...commonProps}><path d="M6 4h7a4 4 0 1 1 0 8H6z" /><path d="M6 12h8a4 4 0 1 1 0 8H6z" /></svg>;
    case "italic":
        return <svg {...commonProps}><line x1="10" y1="4" x2="18" y2="4" /><line x1="6" y1="20" x2="14" y2="20" /><line x1="14" y1="4" x2="10" y2="20" /></svg>;
    case "inline_code":
        return <svg {...commonProps}><polyline points="8 8 4 12 8 16" /><polyline points="16 8 20 12 16 16" /><line x1="13" y1="6" x2="11" y2="18" /></svg>;
    case "quote":
        return <svg {...commonProps}><path d="M8 9h-3v6h6v-3h-3z" /><path d="M19 9h-3v6h6v-3h-3z" /></svg>;
    case "link":
        return <svg {...commonProps}><path d="M10 14l4-4" /><path d="M7 17a4 4 0 0 1 0-6l2-2a4 4 0 0 1 6 0" /><path d="M17 7a4 4 0 0 1 0 6l-2 2a4 4 0 0 1-6 0" /></svg>;
    case "list":
        return <svg {...commonProps}><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><line x1="4" y1="6" x2="4.01" y2="6" /><line x1="4" y1="12" x2="4.01" y2="12" /><line x1="4" y1="18" x2="4.01" y2="18" /></svg>;
    case "code_block":
        return <svg {...commonProps}><polyline points="9 7 4 12 9 17" /><polyline points="15 7 20 12 15 17" /></svg>;
    case "h1":
        return <svg {...commonProps}><path d="M4 6v12" /><path d="M10 6v12" /><path d="M4 12h6" /><path d="M18 6v12" /></svg>;
    case "h2":
        return <svg {...commonProps}><path d="M4 6v12" /><path d="M10 6v12" /><path d="M4 12h6" /><path d="M15 9c0-2 2-3 4-3s4 1 4 3c0 4-6 4-6 8h6" /></svg>;
    case "h3":
        return <svg {...commonProps}><path d="M4 6v12" /><path d="M10 6v12" /><path d="M4 12h6" /><path d="M17 8h4l-3 4h1a3 3 0 1 1 0 6h-4" /></svg>;
    case "h4":
        return <svg {...commonProps}><path d="M4 6v12" /><path d="M10 6v12" /><path d="M4 12h6" /><path d="M20 18V6l-4 8h6" /></svg>;
    case "table":
        return <svg {...commonProps}><rect x="3" y="5" width="18" height="14" rx="1" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="5" x2="9" y2="19" /><line x1="15" y1="5" x2="15" y2="19" /></svg>;
    case "spoiler":
        return <svg {...commonProps}><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case "mermaid":
        return <svg {...commonProps}><path d="M4 7h6l2 3h8" /><path d="M4 17h6l2-3h8" /><circle cx="4" cy="7" r="1.5" /><circle cx="4" cy="17" r="1.5" /><circle cx="20" cy="10" r="1.5" /><circle cx="20" cy="14" r="1.5" /></svg>;
    case "platform_video":
        return <svg {...commonProps}><rect x="3" y="7" width="18" height="10" rx="3" /><polygon points="11,10 15,12 11,14" fill="currentColor" stroke="none" /></svg>;
    case "upload_image":
        return <svg {...commonProps}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.4" /><path d="M7 16l4-4 3 3 3-2 2 3" /></svg>;
    case "upload_video":
        return <svg {...commonProps}><rect x="3" y="6" width="12" height="12" rx="2" /><polygon points="10,10 10,14 13,12" fill="currentColor" stroke="none" /><path d="M15 10l6-3v10l-6-3z" /></svg>;
    default:
        return <svg {...commonProps}><circle cx="12" cy="12" r="5" /></svg>;
    }
}

function MarkdownToolbar({
    preset = "comment",
    textareaRef,
    value,
    setValue,
    onApply,
    disabled = false,
    className = "",
    ...props
}) {
    const actions = getMarkdownToolbarPreset(preset);
    const [tooltip, setTooltip] = useState(null);

    const showTooltip = (event, text) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltip({
            text,
            left: rect.left + rect.width / 2,
            top: rect.top - 8,
        });
    };

    const hideTooltip = () => {
        setTooltip(null);
    };

    const handleApply = (action) => {
        if (disabled) {
            return;
        }

        if (onApply) {
            onApply(action);
            requestAnimationFrame(() => {
                textareaRef?.current?.focus();
            });
            return;
        }

        applyActionToValue({
            textareaRef,
            value,
            setValue,
            actionId: action.id,
        });
    };

    return (
        <div
            className={`markdown-toolbar ${className}`.trim()}
            role="toolbar"
            aria-label={`${preset} markdown formatting`}
            {...props}
        >
            <div className="markdown-toolbar-scroll">
                {actions.map((action) => (
                    <button
                        key={action.id}
                        type="button"
                        className="markdown-toolbar-button"
                        aria-label={action.label}
                        title={action.title}
                        data-tooltip={action.label}
                        disabled={disabled}
                        onMouseEnter={(event) => showTooltip(event, action.label)}
                        onMouseLeave={hideTooltip}
                        onFocus={(event) => showTooltip(event, action.label)}
                        onBlur={hideTooltip}
                        onClick={() => handleApply(action)}
                    >
                        <span className="markdown-toolbar-icon" aria-hidden="true">
                            <MarkdownToolbarIcon icon={action.icon || action.id} />
                        </span>
                    </button>
                ))}
            </div>
            {
                tooltip && typeof document !== "undefined" && createPortal(
                    <div
                        className="markdown-toolbar-tooltip"
                        role="tooltip"
                        style={{
                            left: `${tooltip.left}px`,
                            top: `${tooltip.top}px`,
                        }}
                    >
                        {tooltip.text}
                    </div>,
                    document.body,
                )
            }
        </div>
    );
}

export default MarkdownToolbar;
