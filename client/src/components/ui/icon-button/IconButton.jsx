import "./IconButton.css";

function IconButton({
    type = "button",
    variant = "default",
    size = "md",
    className = "",
    children,
    "aria-label": ariaLabel,
    ...props
}) {
    const classes = [
        "ui-icon-button",
        `ui-icon-button--${variant}`,
        `ui-icon-button--${size}`,
        className,
    ].filter(Boolean).join(" ");

    return (
        <button type={type} aria-label={ariaLabel} className={classes} {...props}>
            {children}
        </button>
    );
}

export default IconButton;
