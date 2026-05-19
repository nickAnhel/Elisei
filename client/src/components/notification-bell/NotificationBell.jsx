import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useLocation, useNavigate } from "react-router-dom";

import "./NotificationBell.css";

import NotificationService from "../../service/NotificationService";
import BellIcon from "../icons/BellIcon";

const PAGE_LIMIT = 20;
const TOAST_TTL_MS = 4500;

function normalizeNotification(item) {
    return {
        notification_id: item.notification_id,
        recipient_id: item.recipient_id,
        notification_type: item.notification_type,
        actor_id: item.actor_id,
        actor: item.actor,
        content_id: item.content_id,
        chat_id: item.chat_id,
        message_id: item.message_id,
        title: item.title,
        body: item.body,
        metadata: item.metadata || {},
        read_at: item.read_at,
        created_at: item.created_at,
    };
}

function mergeNotificationLists(prevList, nextList) {
    const byId = new Map(prevList.map((item) => [item.notification_id, item]));
    nextList.forEach((item) => {
        byId.set(item.notification_id, {
            ...byId.get(item.notification_id),
            ...item,
        });
    });

    return Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

function resolveTarget(notification) {
    if (notification.notification_type === "publication") {
        if (notification.metadata?.canonical_path) {
            return notification.metadata.canonical_path;
        }
        if (notification.content_id) {
            return `/posts/${notification.content_id}`;
        }
        return "/feed";
    }

    if (notification.notification_type === "messenger" && notification.chat_id) {
        return `/chats/@${notification.chat_id}`;
    }

    return "/feed";
}

function NotificationBell({ isAuthenticated, userId }) {
    const navigate = useNavigate();
    const location = useLocation();

    const rootRef = useRef(null);
    const socketRef = useRef(null);
    const dismissTimersRef = useRef(new Map());
    const pathnameRef = useRef(location.pathname);

    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("all");
    const [itemsByTab, setItemsByTab] = useState({
        all: [],
        publication: [],
        messenger: [],
    });
    const [beforeByTab, setBeforeByTab] = useState({
        all: null,
        publication: null,
        messenger: null,
    });
    const [hasMoreByTab, setHasMoreByTab] = useState({
        all: true,
        publication: true,
        messenger: true,
    });
    const [loadingByTab, setLoadingByTab] = useState({
        all: false,
        publication: false,
        messenger: false,
    });
    const [errorByTab, setErrorByTab] = useState({
        all: "",
        publication: "",
        messenger: "",
    });
    const [unreadCount, setUnreadCount] = useState(0);
    const [toasts, setToasts] = useState([]);

    const activeItems = itemsByTab[activeTab] || [];
    const activeLoading = loadingByTab[activeTab];
    const activeError = errorByTab[activeTab];
    const activeHasMore = hasMoreByTab[activeTab];

    const unreadBadge = useMemo(() => {
        if (unreadCount <= 0) {
            return null;
        }
        if (unreadCount > 99) {
            return "99+";
        }
        return String(unreadCount);
    }, [unreadCount]);

    const clearToastTimer = useCallback((toastId) => {
        const timer = dismissTimersRef.current.get(toastId);
        if (timer) {
            clearTimeout(timer);
            dismissTimersRef.current.delete(toastId);
        }
    }, []);

    const removeToast = useCallback((toastId) => {
        clearToastTimer(toastId);
        setToasts((prev) => prev.filter((item) => item.toast_id !== toastId));
    }, [clearToastTimer]);

    const enqueueToast = useCallback((notification) => {
        const toastId = `${notification.notification_id}-${Date.now()}`;
        setToasts((prev) => [
            {
                toast_id: toastId,
                notification,
            },
            ...prev,
        ].slice(0, 2));

        const timeoutId = setTimeout(() => {
            removeToast(toastId);
        }, TOAST_TTL_MS);
        dismissTimersRef.current.set(toastId, timeoutId);
    }, [removeToast]);

    const markLocalRead = useCallback((notificationId) => {
        setItemsByTab((prev) => ({
            all: prev.all.map((item) => (
                item.notification_id === notificationId
                    ? { ...item, read_at: item.read_at || new Date().toISOString() }
                    : item
            )),
            publication: prev.publication.map((item) => (
                item.notification_id === notificationId
                    ? { ...item, read_at: item.read_at || new Date().toISOString() }
                    : item
            )),
            messenger: prev.messenger.map((item) => (
                item.notification_id === notificationId
                    ? { ...item, read_at: item.read_at || new Date().toISOString() }
                    : item
            )),
        }));
    }, []);

    const applyIncomingNotification = useCallback((rawNotification) => {
        const notification = normalizeNotification(rawNotification);

        setItemsByTab((prev) => ({
            all: mergeNotificationLists(prev.all, [notification]),
            publication: notification.notification_type === "publication"
                ? mergeNotificationLists(prev.publication, [notification])
                : prev.publication,
            messenger: notification.notification_type === "messenger"
                ? mergeNotificationLists(prev.messenger, [notification])
                : prev.messenger,
        }));

        if (!notification.read_at) {
            setUnreadCount((prev) => prev + 1);
        }

        const onMessengerRoute = pathnameRef.current.startsWith("/chats");
        const suppressToast = onMessengerRoute && notification.notification_type === "messenger";
        if (!suppressToast) {
            enqueueToast(notification);
        }
    }, [enqueueToast]);

    const loadTab = useCallback(async (tab, { append = false } = {}) => {
        setLoadingByTab((prev) => ({ ...prev, [tab]: true }));
        setErrorByTab((prev) => ({ ...prev, [tab]: "" }));

        try {
            const res = await NotificationService.getNotifications({
                type: tab,
                limit: PAGE_LIMIT,
                before: append ? beforeByTab[tab] : null,
            });
            const fetched = (res.data || []).map(normalizeNotification);

            setItemsByTab((prev) => ({
                ...prev,
                [tab]: append ? mergeNotificationLists(prev[tab], fetched) : fetched,
            }));
            setHasMoreByTab((prev) => ({
                ...prev,
                [tab]: fetched.length >= PAGE_LIMIT,
            }));
            setBeforeByTab((prev) => ({
                ...prev,
                [tab]: fetched.length > 0 ? fetched[fetched.length - 1].created_at : prev[tab],
            }));
        } catch (error) {
            setErrorByTab((prev) => ({
                ...prev,
                [tab]: error?.response?.data?.detail || "Failed to load notifications",
            }));
        } finally {
            setLoadingByTab((prev) => ({ ...prev, [tab]: false }));
        }
    }, [beforeByTab]);

    const bootstrap = useCallback(async () => {
        try {
            const res = await NotificationService.bootstrap();
            const recent = (res.data?.recent || []).map(normalizeNotification);
            const publication = recent.filter((item) => item.notification_type === "publication");
            const messenger = recent.filter((item) => item.notification_type === "messenger");

            setItemsByTab({
                all: recent,
                publication,
                messenger,
            });
            setUnreadCount(res.data?.unread_count || 0);
            setBeforeByTab({
                all: recent.length > 0 ? recent[recent.length - 1].created_at : null,
                publication: publication.length > 0 ? publication[publication.length - 1].created_at : null,
                messenger: messenger.length > 0 ? messenger[messenger.length - 1].created_at : null,
            });
            setHasMoreByTab({
                all: recent.length >= PAGE_LIMIT,
                publication: publication.length >= PAGE_LIMIT,
                messenger: messenger.length >= PAGE_LIMIT,
            });
        } catch (_error) {
            setItemsByTab({ all: [], publication: [], messenger: [] });
            setUnreadCount(0);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !userId) {
            setIsOpen(false);
            setToasts([]);
            setUnreadCount(0);
            setItemsByTab({ all: [], publication: [], messenger: [] });
            return;
        }

        bootstrap();
    }, [bootstrap, isAuthenticated, userId]);

    useEffect(() => {
        pathnameRef.current = location.pathname;
    }, [location.pathname]);

    useEffect(() => {
        if (!isAuthenticated || !userId) {
            socketRef.current?.disconnect();
            socketRef.current = null;
            return;
        }

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        socketRef.current = io(process.env.REACT_APP_WS_HOST, {
            path: "/ws",
            transports: ["websocket"],
            upgrade: false,
            auth: {
                token: localStorage.getItem("token"),
            },
        });

        socketRef.current.on("connect_error", (error) => {
            console.error("Notification socket connect_error", error?.message || error);
        });

        socketRef.current.on("notification:created", (data) => {
            try {
                const parsed = typeof data === "string" ? JSON.parse(data) : data;
                applyIncomingNotification(parsed);
            } catch (error) {
                console.error("Failed to parse notification payload", error);
            }
        });

        return () => {
            socketRef.current?.off("connect_error");
            socketRef.current?.off("notification:created");
            socketRef.current?.disconnect();
            socketRef.current = null;
        };
    }, [applyIncomingNotification, isAuthenticated, userId]);

    useEffect(() => {
        const onClickOutside = (event) => {
            if (!rootRef.current) {
                return;
            }
            if (!rootRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", onClickOutside);
        return () => {
            document.removeEventListener("mousedown", onClickOutside);
        };
    }, []);

    useEffect(() => {
        const timers = dismissTimersRef.current;
        return () => {
            timers.forEach((timerId) => clearTimeout(timerId));
            timers.clear();
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        if (itemsByTab[activeTab]?.length > 0 || loadingByTab[activeTab]) {
            return;
        }
        loadTab(activeTab);
    }, [activeTab, isOpen, itemsByTab, loadTab, loadingByTab]);

    const handleNotificationClick = async (notification) => {
        const target = resolveTarget(notification);

        if (!notification.read_at) {
            markLocalRead(notification.notification_id);
            setUnreadCount((prev) => Math.max(prev - 1, 0));
            try {
                await NotificationService.markRead(notification.notification_id);
            } catch (_error) {
                // keep optimistic local state
            }
        }

        setIsOpen(false);
        navigate(target);
    };

    const handleMarkAllRead = async () => {
        try {
            await NotificationService.markAllRead();
            setItemsByTab((prev) => ({
                all: prev.all.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })),
                publication: prev.publication.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })),
                messenger: prev.messenger.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })),
            }));
            setUnreadCount(0);
        } catch (_error) {
            // no-op
        }
    };

    const formatDate = (value) => {
        if (!value) {
            return "";
        }
        const date = new Date(value);
        const now = new Date();
        const sameDay = date.toDateString() === now.toDateString();
        if (sameDay) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="notification-bell-root" ref={rootRef}>
            <button
                type="button"
                className={`notification-bell-trigger${isOpen ? " active" : ""}`}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label="Open notifications"
            >
                <BellIcon />
                {unreadBadge && <span className="notification-bell-badge">{unreadBadge}</span>}
            </button>

            {isOpen && (
                <div className="notification-popup">
                    <div className="notification-popup-header">
                        <div className="notification-popup-tabs">
                            {["all", "publication", "messenger"].map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={`notification-tab${activeTab === tab ? " active" : ""}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab === "all" ? "All" : tab === "publication" ? "Publications" : "Messenger"}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="notification-mark-all" onClick={handleMarkAllRead}>
                            Mark all as read
                        </button>
                    </div>

                    <div className="notification-popup-list">
                        {activeLoading && <div className="notification-state">Loading notifications...</div>}
                        {!activeLoading && activeError && <div className="notification-state error">{activeError}</div>}
                        {!activeLoading && !activeError && activeItems.length === 0 && (
                            <div className="notification-state">No notifications yet</div>
                        )}

                        {!activeLoading && !activeError && activeItems.map((item) => (
                            <button
                                key={item.notification_id}
                                type="button"
                                className={`notification-item${item.read_at ? " read" : " unread"}`}
                                onClick={() => handleNotificationClick(item)}
                            >
                                <div className="notification-item-main">
                                    <div className="notification-item-title">{item.title}</div>
                                    {item.body && <div className="notification-item-body">{item.body}</div>}
                                </div>
                                <div className="notification-item-date">{formatDate(item.created_at)}</div>
                            </button>
                        ))}
                    </div>

                    {!activeLoading && !activeError && activeItems.length > 0 && activeHasMore && (
                        <button
                            type="button"
                            className="notification-load-more"
                            onClick={() => loadTab(activeTab, { append: true })}
                        >
                            Load more
                        </button>
                    )}
                </div>
            )}

            <div className="notification-toast-stack">
                {toasts.map((toast, index) => (
                    <button
                        key={toast.toast_id}
                        type="button"
                        className={`notification-toast${index > 0 ? " old" : ""}`}
                        onClick={() => {
                            removeToast(toast.toast_id);
                            handleNotificationClick(toast.notification);
                        }}
                    >
                        <div className="notification-toast-title">{toast.notification.title}</div>
                        {toast.notification.body && (
                            <div className="notification-toast-body">{toast.notification.body}</div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default NotificationBell;
