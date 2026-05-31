import { useContext } from "react";
import { useOutlet, useParams } from "react-router-dom";

import "./Chats.css";

import { StoreContext } from "../..";

import Unauthorized from "../../components/unauthorized/Unauthorized";
import ChatSidebar from "../../components/chat-sidebar/ChatSidebar";
import { Card, EmptyState } from "../../components/ui";




function Chats() {
    const { store } = useContext(StoreContext);
    const outlet = useOutlet();
    const { chatId } = useParams();
    const hasActiveChat = Boolean(chatId);

    if (!store.isAuthenticated) {
        return (
            <div id="chats" className="chats-shell chats-shell--unauthorized">
                <Unauthorized />
            </div>
        );
    }

    return (
        <div
            id="chats"
            className={`chats-shell${hasActiveChat ? " chats-shell--has-active-chat" : ""}`}
        >
            <section className="chats-shell__sidebar" aria-label="Chats list">
                <ChatSidebar />
            </section>
            <section className="chats-shell__content" aria-label="Chat conversation">
                {outlet || (
                    <Card className="chats-shell__placeholder" variant="raised">
                        <EmptyState
                            title="Select a chat"
                            description="Choose a conversation from the left to open message history and composer."
                        />
                    </Card>
                )}
            </section>
        </div>
    );
}

export default Chats;
