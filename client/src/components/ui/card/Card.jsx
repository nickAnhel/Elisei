import "./Card.css";

function Card({
    as: Component = "div",
    variant = "default",
    padding = "md",
    className = "",
    children,
    ...props
}) {
    const classes = [
        "ui-card",
        `ui-card--${variant}`,
        `ui-card--padding-${padding}`,
        className,
    ].filter(Boolean).join(" ");

    return (
        <Component className={classes} {...props}>
            {children}
        </Component>
    );
}

export default Card;
