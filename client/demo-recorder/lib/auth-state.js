const fs = require("fs");

const AUTH_MIN_LIFETIME_SECONDS = 12 * 60;

function getExpectedOrigin(baseUrl) {
    return new URL(baseUrl).origin;
}

function loadAuthState(authStatePath) {
    return JSON.parse(fs.readFileSync(authStatePath, "utf8"));
}

function findOriginEntry(state, origin) {
    return (state.origins || []).find((item) => item.origin === origin);
}

function findTokenEntry(originEntry) {
    return (originEntry?.localStorage || []).find((item) => item.name === "token" && item.value);
}

function decodeJwtPayload(token) {
    try {
        const payloadPart = token.split(".")[1];
        if (!payloadPart) {
            return null;
        }
        return JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    } catch (error) {
        return null;
    }
}

function validateAuthState({ authStatePath, baseUrl }) {
    if (!fs.existsSync(authStatePath)) {
        return {
            ok: false,
            code: "AUTH_STATE_MISSING",
            message: "Demo auth state is missing.",
        };
    }

    let state;
    try {
        state = loadAuthState(authStatePath);
    } catch (error) {
        return {
            ok: false,
            code: "AUTH_STATE_INVALID_JSON",
            message: `Demo auth state is unreadable: ${error.message}`,
        };
    }

    const expectedOrigin = getExpectedOrigin(baseUrl);
    const originEntry = findOriginEntry(state, expectedOrigin);
    if (!originEntry) {
        const availableOrigins = (state.origins || []).map((item) => item.origin);
        return {
            ok: false,
            code: "AUTH_STATE_ORIGIN_MISMATCH",
            message: [
                `Demo auth state does not match DEMO_BASE_URL origin ${expectedOrigin}.`,
                availableOrigins.length > 0
                    ? `Auth state currently contains origins: ${availableOrigins.join(", ")}`
                    : "Auth state does not contain any saved origins.",
            ].join("\n"),
        };
    }

    const tokenEntry = findTokenEntry(originEntry);
    if (!tokenEntry) {
        return {
            ok: false,
            code: "AUTH_STATE_TOKEN_MISSING",
            message: `Demo auth state for ${expectedOrigin} does not contain a saved token.`,
        };
    }

    const tokenPayload = decodeJwtPayload(tokenEntry.value);
    if (!tokenPayload?.exp) {
        return {
            ok: false,
            code: "AUTH_STATE_TOKEN_INVALID",
            message: `Demo auth state for ${expectedOrigin} contains an unreadable access token.`,
        };
    }

    const expiresAt = Number(tokenPayload.exp);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const remainingLifetimeSeconds = expiresAt - nowSeconds;

    if (remainingLifetimeSeconds <= 0) {
        return {
            ok: false,
            code: "AUTH_STATE_TOKEN_EXPIRED",
            message: `Demo auth token for ${expectedOrigin} has expired.`,
            expiresAt,
            remainingLifetimeSeconds,
        };
    }

    if (remainingLifetimeSeconds < AUTH_MIN_LIFETIME_SECONDS) {
        return {
            ok: false,
            code: "AUTH_STATE_TOKEN_EXPIRING_SOON",
            message: `Demo auth token for ${expectedOrigin} expires too soon for a stable recording run (${remainingLifetimeSeconds}s remaining).`,
            expiresAt,
            remainingLifetimeSeconds,
        };
    }

    return {
        ok: true,
        origin: expectedOrigin,
        expiresAt,
        remainingLifetimeSeconds,
    };
}

function ensureValidAuthState({ authStatePath, baseUrl }) {
    const validation = validateAuthState({ authStatePath, baseUrl });
    if (validation.ok) {
        return validation;
    }

    const error = new Error(
        [
            validation.message,
            "Rerun demo authentication for the current base URL:",
            "  npm run demo:auth",
        ].join("\n"),
    );
    error.code = validation.code;
    throw error;
}

module.exports = {
    AUTH_MIN_LIFETIME_SECONDS,
    ensureValidAuthState,
    validateAuthState,
};
