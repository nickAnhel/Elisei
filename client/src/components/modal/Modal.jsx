import "./Modal.css"


function Modal({ active, setActive, children, contentClassName = "" }) {
    const contentClasses = [
        active ? "modal-content active" : "modal-content",
        contentClassName,
    ].filter(Boolean).join(" ");

    return (
        <div className={active ? "modal active" : "modal"} onClick={() => setActive(false)}>
            <div className={contentClasses} onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}

export default Modal;
