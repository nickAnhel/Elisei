import "./Tooltip.css";

function Tooltip({ content, children, side = "top", className = "" }) {
    if (!content) {
        return children;
    }

    const classes = [
        "ui-tooltip",
        `ui-tooltip--${side}`,
        className,
    ].filter(Boolean).join(" ");

    return (
        <span className={classes}>
            <span className="ui-tooltip__trigger">{children}</span>
            <span className="ui-tooltip__content" role="tooltip">{content}</span>
        </span>
    );
}

export default Tooltip;
