import { createPortal } from "react-dom";

import "./Modal.css"


function Modal({ active, setActive, children, contentClassName = "" }) {
    const contentClasses = [
        active ? "modal-content active" : "modal-content",
        contentClassName,
    ].filter(Boolean).join(" ");

    const modalNode = (
        <div className={active ? "modal active" : "modal"} onClick={() => setActive(false)}>
            <div className={contentClasses} onClick={e => e.stopPropagation()}>
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
