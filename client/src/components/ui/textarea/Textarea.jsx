import { useId } from "react";

import "./Textarea.css";

function Textarea({
    id,
    label,
    hint,
    error,
    fullWidth = false,
    className = "",
    rows = 4,
    ...props
}) {
    const generatedId = useId();
    const textareaId = id || generatedId;

    const rootClass = [
        "ui-textarea",
        fullWidth ? "ui-textarea--full-width" : "",
        error ? "has-error" : "",
        className,
    ].filter(Boolean).join(" ");

    return (
        <label className={rootClass} htmlFor={textareaId}>
            {label ? <span className="ui-textarea__label">{label}</span> : null}
            <textarea id={textareaId} rows={rows} {...props} />
            {error ? <span className="ui-textarea__error">{error}</span> : hint ? <span className="ui-textarea__hint">{hint}</span> : null}
        </label>
    );
}

export default Textarea;
