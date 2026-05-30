export function getUserDisplayName(user, fallback = "Unknown") {
    if (!user) {
        return fallback;
    }

    const displayName = typeof user.display_name === "string" ? user.display_name.trim() : "";
    if (displayName) {
        return displayName;
    }

    const username = typeof user.username === "string" ? user.username.trim() : "";
    if (username) {
        return username;
    }

    return fallback;
}
