import { useId } from "react";

import "./Input.css";

function Input({
    id,
    label,
    hint,
    error,
    leftIcon,
    rightSlot,
    fullWidth = false,
    className = "",
    inputClassName = "",
    ...props
}) {
    const generatedId = useId();
    const inputId = id || generatedId;

    const rootClass = [
        "ui-input",
        fullWidth ? "ui-input--full-width" : "",
        error ? "has-error" : "",
        className,
    ].filter(Boolean).join(" ");

    const controlClass = [
        "ui-input__control",
        inputClassName,
    ].filter(Boolean).join(" ");

    return (
        <label className={rootClass} htmlFor={inputId}>
            {label ? <span className="ui-input__label">{label}</span> : null}
            <span className={controlClass}>
                {leftIcon ? <span className="ui-input__left" aria-hidden="true">{leftIcon}</span> : null}
                <input id={inputId} {...props} />
                {rightSlot ? <span className="ui-input__right">{rightSlot}</span> : null}
            </span>
            {error ? <span className="ui-input__error">{error}</span> : hint ? <span className="ui-input__hint">{hint}</span> : null}
        </label>
    );
}

export default Input;
