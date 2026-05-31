import "./Event.css"


function Event({ action, username, addedUserUsername }) {

    return (
        <>
            <div className="event">
                <span className="event-user">{username} </span>
                {action}
                <span className={addedUserUsername ? "event-user" : ""}> { addedUserUsername ? addedUserUsername : "chat"}</span>
            </div>
        </>
    )
}

export default Event
