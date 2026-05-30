import "./EmptyState.css";

function EmptyState({ icon, title, description, action, className = "" }) {
    const classes = ["ui-empty-state", className].filter(Boolean).join(" ");

    return (
        <div className={classes}>
            {icon ? <div className="ui-empty-state__icon" aria-hidden="true">{icon}</div> : null}
            {title ? <h3 className="ui-empty-state__title">{title}</h3> : null}
            {description ? <p className="ui-empty-state__description">{description}</p> : null}
            {action ? <div className="ui-empty-state__action">{action}</div> : null}
        </div>
    );
}

export default EmptyState;
