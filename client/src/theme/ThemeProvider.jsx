import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { AVAILABLE_MODES, getStoredThemeMode, setStoredThemeMode } from "./themeStorage";
import useSystemTheme from "./useSystemTheme";

const ThemeContext = createContext({
    themeMode: "system",
    resolvedTheme: "dark",
    setThemeMode: () => {},
    modes: AVAILABLE_MODES,
});

function ThemeProvider({ children }) {
    const [themeMode, setThemeModeState] = useState(getStoredThemeMode);
    const systemTheme = useSystemTheme();

    const resolvedTheme = themeMode === "system" ? systemTheme : themeMode;

    useEffect(() => {
        setStoredThemeMode(themeMode);
    }, [themeMode]);

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute("data-theme", resolvedTheme);
        root.setAttribute("data-theme-mode", themeMode);
    }, [resolvedTheme, themeMode]);

    const setThemeMode = (nextMode) => {
        if (AVAILABLE_MODES.includes(nextMode)) {
            setThemeModeState(nextMode);
        }
    };

    const contextValue = useMemo(() => ({
        themeMode,
        resolvedTheme,
        setThemeMode,
        modes: AVAILABLE_MODES,
    }), [resolvedTheme, themeMode]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}

function useTheme() {
    return useContext(ThemeContext);
}

export { ThemeProvider, useTheme };
