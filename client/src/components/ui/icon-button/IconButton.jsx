import { forwardRef } from "react";

import "./IconButton.css";

const IconButton = forwardRef(function IconButton({
    type = "button",
    variant = "default",
    size = "md",
    className = "",
    children,
    "aria-label": ariaLabel,
    ...props
}, ref) {
    const classes = [
        "ui-icon-button",
        `ui-icon-button--${variant}`,
        `ui-icon-button--${size}`,
        className,
    ].filter(Boolean).join(" ");

    return (
        <button ref={ref} type={type} aria-label={ariaLabel} className={classes} {...props}>
            {children}
        </button>
    );
});

export default IconButton;
