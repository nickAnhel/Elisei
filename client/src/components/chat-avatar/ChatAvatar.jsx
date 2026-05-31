import { useEffect, useMemo, useState } from "react";

import "./ChatAvatar.css";

const CHAT_AVATAR_PALETTES = [
    { from: "#5f4ac8", to: "#8668ff" },
    { from: "#0f9b6d", to: "#1ac188" },
    { from: "#c95d2e", to: "#ef7a43" },
    { from: "#1b7ab5", to: "#3ea2df" },
    { from: "#9f2f8f", to: "#cd4ab7" },
    { from: "#b5521d", to: "#da7d2f" },
];

function hashSeed(seed) {
    const normalized = String(seed || "");
    let hash = 0;

    for (let index = 0; index < normalized.length; index += 1) {
        hash = (hash << 5) - hash + normalized.charCodeAt(index);
        hash |= 0;
    }

    return Math.abs(hash);
}

function getAvatarInitial(title) {
    if (!title) {
        return "?";
    }

    const normalized = String(title).trim();
    if (!normalized) {
        return "?";
    }

    return normalized[0].toUpperCase();
}

function ChatAvatar({
    src = null,
    title = "",
    seed = "",
    className = "",
}) {
    const [isImageBroken, setIsImageBroken] = useState(false);

    useEffect(() => {
        setIsImageBroken(false);
    }, [src]);

    const palette = useMemo(() => {
        const index = hashSeed(seed || title) % CHAT_AVATAR_PALETTES.length;
        return CHAT_AVATAR_PALETTES[index];
    }, [seed, title]);

    const showImage = Boolean(src) && !isImageBroken;

    return (
        <span
            className={["chat-avatar", className].filter(Boolean).join(" ")}
            style={{
                "--chat-avatar-from": palette.from,
                "--chat-avatar-to": palette.to,
            }}
            aria-label={title || "Chat avatar"}
        >
            {
                showImage
                    ? (
                        <img
                            src={src}
                            alt={title || "Chat avatar"}
                            onError={() => setIsImageBroken(true)}
                        />
                    )
                    : <span aria-hidden="true">{getAvatarInitial(title)}</span>
            }
        </span>
    );
}

export default ChatAvatar;
