export const DEMO_MODE_QUERY_PARAM = "demo";
export const DEMO_MODE_STORAGE_KEY = "demoMode";

function readLocalStorageDemoFlag(runtimeWindow) {
    try {
        return runtimeWindow?.localStorage?.getItem(DEMO_MODE_STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

export function isDemoMode(runtimeWindow = typeof window !== "undefined" ? window : null) {
    const envEnabled = process.env.REACT_APP_DEMO_MODE === "true";
    if (!runtimeWindow) {
        return envEnabled;
    }

    const searchParams = new URLSearchParams(runtimeWindow.location.search);
    if (searchParams.get(DEMO_MODE_QUERY_PARAM) === "1") {
        return true;
    }

    if (readLocalStorageDemoFlag(runtimeWindow)) {
        return true;
    }

    return envEnabled;
}
