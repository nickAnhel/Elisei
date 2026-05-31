import "./Button.css";

function Button({
    type = "button",
    variant = "primary",
    size = "md",
    disabled = false,
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className = "",
    children,
    ...props
}) {
    const classes = [
        "ui-button",
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth ? "ui-button--full-width" : "",
        loading ? "is-loading" : "",
        className,
    ].filter(Boolean).join(" ");

    return (
        <button
            type={type}
            className={classes}
            disabled={disabled || loading}
            aria-busy={loading ? "true" : undefined}
            {...props}
        >
            {loading && <span className="ui-button__spinner" aria-hidden="true" />}
            {!loading && leftIcon ? <span className="ui-button__icon" aria-hidden="true">{leftIcon}</span> : null}
            <span className="ui-button__label">{children}</span>
            {!loading && rightIcon ? <span className="ui-button__icon" aria-hidden="true">{rightIcon}</span> : null}
        </button>
    );
}

export default Button;
