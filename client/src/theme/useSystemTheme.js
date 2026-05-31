import { useEffect, useState } from "react";

const QUERY = "(prefers-color-scheme: dark)";

function getPreferredTheme() {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return "dark";
    }

    return window.matchMedia(QUERY).matches ? "dark" : "light";
}

function useSystemTheme() {
    const [systemTheme, setSystemTheme] = useState(getPreferredTheme);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return undefined;
        }

        const mediaQuery = window.matchMedia(QUERY);
        const handleChange = (event) => setSystemTheme(event.matches ? "dark" : "light");

        mediaQuery.addEventListener("change", handleChange);
        setSystemTheme(mediaQuery.matches ? "dark" : "light");

        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    return systemTheme;
}

export default useSystemTheme;
