import { useMemo } from "react";

import "./Avatar.css";

function getInitials(fallbackText) {
    if (!fallbackText) {
        return "?";
    }

    const words = String(fallbackText).trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        return "?";
    }

    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function Avatar({
    src,
    alt,
    fallback,
    size = "md",
    className = "",
    ...props
}) {
    const fallbackInitials = useMemo(() => getInitials(fallback || alt), [fallback, alt]);

    const classes = [
        "ui-avatar",
        `ui-avatar--${size}`,
        className,
    ].filter(Boolean).join(" ");

    return (
        <span className={classes} {...props}>
            {src ? <img src={src} alt={alt || fallbackInitials} /> : <span aria-hidden="true">{fallbackInitials}</span>}
        </span>
    );
}

export default Avatar;
