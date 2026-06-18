import { useEffect } from "react";

import Sidebar from "../sidebar/Sidebar";
import DemoCursor from "../demo-cursor/DemoCursor";
import { useDemoMode } from "../../utils/demoMode";

import "./AppShell.css";

function AppShell({ children }) {
    const demoMode = useDemoMode();

    useEffect(() => {
        document.body.classList.toggle("demo-mode", demoMode);
        document.documentElement.classList.toggle("demo-mode", demoMode);

        return () => {
            document.body.classList.remove("demo-mode");
            document.documentElement.classList.remove("demo-mode");
        };
    }, [demoMode]);

    return (
        <div className={`app-shell${demoMode ? " app-shell--demo" : ""}`} data-demo-mode={demoMode ? "true" : "false"}>
            <aside className="app-shell__sidebar" aria-label="Primary navigation">
                <Sidebar />
            </aside>
            <main className="app-shell__content">
                {children}
            </main>
            {demoMode ? <DemoCursor /> : null}
        </div>
    );
}

export default AppShell;
