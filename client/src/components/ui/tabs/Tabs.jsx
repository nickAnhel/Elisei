import { createContext, useContext, useMemo } from "react";

import "./Tabs.css";

const TabsContext = createContext(null);

function Tabs({ value, onValueChange, children, className = "" }) {
    const contextValue = useMemo(() => ({ value, onValueChange }), [onValueChange, value]);
    const classes = ["ui-tabs", className].filter(Boolean).join(" ");

    return (
        <TabsContext.Provider value={contextValue}>
            <div className={classes}>{children}</div>
        </TabsContext.Provider>
    );
}

function TabsList({ children, className = "" }) {
    const classes = ["ui-tabs-list", className].filter(Boolean).join(" ");
    return <div className={classes} role="tablist">{children}</div>;
}

function TabsTrigger({ value, children, className = "", ...props }) {
    const context = useContext(TabsContext);
    const isActive = context?.value === value;
    const classes = [
        "ui-tabs-trigger",
        isActive ? "active" : "",
        className,
    ].filter(Boolean).join(" ");

    return (
        <button
            type="button"
            className={classes}
            role="tab"
            aria-selected={isActive}
            onClick={() => context?.onValueChange?.(value)}
            {...props}
        >
            {children}
        </button>
    );
}

function TabsContent({ value, children, className = "" }) {
    const context = useContext(TabsContext);

    if (context?.value !== value) {
        return null;
    }

    const classes = ["ui-tabs-content", className].filter(Boolean).join(" ");
    return <div className={classes} role="tabpanel">{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
