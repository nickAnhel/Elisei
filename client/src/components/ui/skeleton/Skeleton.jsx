import "./Skeleton.css";

function Skeleton({
    variant = "text",
    width,
    height,
    className = "",
    style,
    ...props
}) {
    const classes = [
        "ui-skeleton",
        `ui-skeleton--${variant}`,
        className,
    ].filter(Boolean).join(" ");

    return (
        <span
            className={classes}
            style={{ width, height, ...style }}
            aria-hidden="true"
            {...props}
        />
    );
}

export default Skeleton;
