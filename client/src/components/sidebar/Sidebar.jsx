import { useContext, useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { observer } from "mobx-react-lite";

import "./Sidebar.css";

import { StoreContext } from "../..";
import ActivityIcon from "../icons/ActivityIcon";
import ArticleIcon from "../icons/ArticleIcon";
import ChatIcon from "../icons/ChatIcon";
import FeedIcon from "../icons/FeedIcon";
import LoginIcon from "../icons/LoginIcon";
import MomentsIcon from "../icons/MomentsIcon";
import PeopleIcon from "../icons/PeopleIcon";
import SearchIcon from "../icons/SearchIcon";
import VideoIcon from "../icons/VideoIcon";
import { getAvatarRenderKey, getAvatarUrl } from "../../utils/avatar";
import NotificationBell from "../notification-bell/NotificationBell";


function Sidebar() {
    const { store } = useContext(StoreContext);
    const avatarSrc = getAvatarUrl(store.user, "small");
    const avatarRenderKey = getAvatarRenderKey(store.user, "small");
    const [isMobileNav, setIsMobileNav] = useState(
        typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false,
    );

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const media = window.matchMedia("(max-width: 768px)");
        const handleChange = (event) => {
            setIsMobileNav(event.matches);
        };

        setIsMobileNav(media.matches);
        media.addEventListener("change", handleChange);
        return () => {
            media.removeEventListener("change", handleChange);
        };
    }, []);

    return (
        <div id="sidebar">
            <div id="sidebar-top">
                <NavLink to="/people" className="sidebar-item sidebar-item-people">
                    <PeopleIcon />
                    People
                </NavLink>
                <NavLink to="/search?type=all" className="sidebar-item sidebar-item-search">
                    <SearchIcon />
                    Search
                </NavLink>
                <NavLink to="/feed" className="sidebar-item sidebar-item-feed">
                    <FeedIcon />
                    Feed
                </NavLink>
                <NavLink to="/articles" className="sidebar-item sidebar-item-articles">
                    <ArticleIcon />
                    Articles
                </NavLink>
                <NavLink to="/videos" className="sidebar-item sidebar-item-videos">
                    <VideoIcon />
                    Videos
                </NavLink>
                <NavLink to="/moments" className="sidebar-item sidebar-item-moments">
                    <MomentsIcon />
                    Moments
                </NavLink>
                {
                    store.isAuthenticated &&
                    <NavLink to="/chats" className="sidebar-item sidebar-item-chats">
                        <ChatIcon />
                        Chats
                    </NavLink>
                }
                {
                    store.isAuthenticated &&
                    <NavLink to="/activity" className="sidebar-item sidebar-item-activity">
                        <ActivityIcon />
                        Activity
                    </NavLink>
                }
                {
                    store.isAuthenticated &&
                    <NavLink to="/profile?tab=account" className="sidebar-item sidebar-item-profile-mobile">
                        <img
                            key={`${avatarRenderKey}-mobile`}
                            className="profile profile-mobile"
                            src={avatarSrc}
                            onError={(e) => { e.currentTarget.src = "/assets/profile.svg"; }}
                            alt="Profile"
                        />
                        Profile
                    </NavLink>
                }
                {
                    !store.isAuthenticated &&
                    <Link to="/login" className="sidebar-item sidebar-item-login-mobile">
                        <LoginIcon />
                        Login
                    </Link>
                }
            </div>

            <div id="sidebar-bottom">
                {
                    store.isAuthenticated
                        ? (
                            <>
                                <Link to="/profile" className="sidebar-item profile-link profile-link-desktop">
                                    <img
                                        key={avatarRenderKey}
                                        className="profile"
                                        src={avatarSrc}
                                        onError={(e) => { e.currentTarget.src = "/assets/profile.svg"; }}
                                        alt="Profile"
                                    />
                                </Link>
                                {!isMobileNav && (
                                    <NotificationBell
                                        isAuthenticated={store.isAuthenticated}
                                        userId={store.user.user_id}
                                    />
                                )}
                            </>
                        )
                        : (
                            <Link to="/login" className="sidebar-item">
                                <LoginIcon />
                            </Link>
                        )
                }
            </div>

            {store.isAuthenticated && isMobileNav && (
                <div className="mobile-notification-anchor" aria-label="Notifications">
                    <NotificationBell
                        isAuthenticated={store.isAuthenticated}
                        userId={store.user.user_id}
                    />
                </div>
            )}
        </div>
    );
}

export default observer(Sidebar);
