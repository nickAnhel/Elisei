import { useEffect } from "react";
import { createPortal } from "react-dom";

import "./Dialog.css";

function Dialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    className = "",
}) {
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                onOpenChange?.(false);
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [onOpenChange, open]);

    if (!open) {
        return null;
    }

    const dialogClasses = ["ui-dialog", className].filter(Boolean).join(" ");

    return createPortal(
        <div className="ui-dialog-overlay" onClick={() => onOpenChange?.(false)} role="presentation">
            <div
                className={dialogClasses}
                role="dialog"
                aria-modal="true"
                aria-label={title || "Dialog"}
                onClick={(event) => event.stopPropagation()}
            >
                {(title || description) && (
                    <header className="ui-dialog__header">
                        {title ? <h2>{title}</h2> : null}
                        {description ? <p>{description}</p> : null}
                    </header>
                )}
                <div className="ui-dialog__content">{children}</div>
            </div>
        </div>,
        document.body,
    );
}

export default Dialog;
