import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import "./Modal.css"


function Modal({ active, setActive, children, contentClassName = "", ariaLabel = "Dialog" }) {
    const dialogRef = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!active) {
            return undefined;
        }

        previousFocusRef.current = document.activeElement;
        dialogRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setActive(false);
            }
        };

        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = previousOverflow;

            const previousFocus = previousFocusRef.current;
            if (previousFocus && typeof previousFocus.focus === "function") {
                previousFocus.focus();
            }
        };
    }, [active, setActive]);

    const contentClasses = [
        active ? "modal-content active" : "modal-content",
        contentClassName,
    ].filter(Boolean).join(" ");

    const modalNode = (
        <div
            className={active ? "modal active" : "modal"}
            onClick={() => setActive(false)}
            aria-hidden={active ? undefined : "true"}
        >
            <div
                ref={dialogRef}
                className={contentClasses}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                tabIndex={-1}
            >
                {children}
            </div>
        </div>
    );

    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(modalNode, document.body);
}

export default Modal;
