import Sidebar from "../sidebar/Sidebar";

import "./AppShell.css";

function AppShell({ children }) {
    return (
        <div className="app-shell">
            <aside className="app-shell__sidebar" aria-label="Primary navigation">
                <Sidebar />
            </aside>
            <main className="app-shell__content">
                {children}
            </main>
        </div>
    );
}

export default AppShell;
