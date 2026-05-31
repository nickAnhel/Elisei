const THEME_STORAGE_KEY = "nerdex-theme-mode";
const AVAILABLE_MODES = ["system", "dark", "light"];

function isValidThemeMode(value) {
    return AVAILABLE_MODES.includes(value);
}

export function getStoredThemeMode() {
    if (typeof window === "undefined") {
        return "system";
    }

    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidThemeMode(raw) ? raw : "system";
}

export function setStoredThemeMode(mode) {
    if (typeof window === "undefined" || !isValidThemeMode(mode)) {
        return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
}

export { AVAILABLE_MODES, THEME_STORAGE_KEY };
