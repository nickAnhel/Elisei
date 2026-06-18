import { useState } from "react";

import "./ChatSidebar.css";

import ChatService from "../../service/ChatService";

import ChatModal from "../chat-modal/ChatModal";

import ChatList from "../../components/chat-list/ChatList";
import SearchIcon from "../icons/SearchIcon";
import CloseIcon from "../icons/CloseIcon";
import { Button, IconButton, Input } from "../ui";


function ChatSidebar() {
    const [isCreateChatActive, setIsCreateChatActive] = useState(false);

    const [query, setQuery] = useState("");
    const [refreshChats, setRefreshChats] = useState(0);
    const isSearch = query.trim().length > 0;

    const handleClear = () => {
        setQuery("");
    };

    return (
        <section id="chat-sidebar">
            <header className="chat-sidebar__header">
                <div className="chat-sidebar__title">Chats</div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateChatActive(true)}
                >
                    Create chat
                </Button>
            </header>

            <div className="chat-sidebar__search">
                <Input
                    id="chat-sidebar-search"
                    type="search"
                    placeholder="Search chats"
                    value={query}
                    maxLength={50}
                    onChange={(event) => setQuery(event.target.value)}
                    fullWidth
                    data-testid="chat-search-input"
                    leftIcon={<SearchIcon />}
                    rightSlot={(
                        <IconButton
                            size="sm"
                            variant="ghost"
                            className={`chat-sidebar__search-clear${query ? " is-visible" : ""}`}
                            aria-label="Clear chat search"
                            onClick={handleClear}
                            disabled={!query}
                        >
                            <CloseIcon />
                        </IconButton>
                    )}
                />
            </div>

            <div className="chat-sidebar__list" data-testid="chat-list">
                {
                    isSearch
                        ? (
                            <ChatList
                                fetchChats={ChatService.searchChats}
                                filters={{ query: query.trim() }}
                                refresh={`search-${query.trim()}`}
                                enableRealtime={false}
                            />
                        )
                        : (
                            <ChatList
                                fetchChats={ChatService.getUserJoinedChats}
                                refresh={`list-${refreshChats}`}
                            />
                        )
                }
            </div>

            <div className="chat-sidebar__footer">
                <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => setIsCreateChatActive(true)}
                >
                    New chat
                </Button>
            </div>

            <ChatModal
                key={"create"}
                active={isCreateChatActive}
                setActive={setIsCreateChatActive}
                saveChatFunc={ChatService.createChat}
                onSaved={() => setRefreshChats((value) => value + 1)}
                modalHeader={"Create new chat"}
                buttonText={"Create chat"}
            />
        </section>
    );
}

export default ChatSidebar;
