import { render, screen } from "@testing-library/react";

jest.mock("../sidebar/Sidebar", () => () => <div>Sidebar</div>);
jest.mock("../demo-cursor/DemoCursor", () => () => <div data-testid="demo-cursor">Demo cursor</div>);
let mockDemoModeValue = false;
jest.mock("../../utils/demoMode", () => ({
    useDemoMode: () => mockDemoModeValue,
}));

import AppShell from "./AppShell";


beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    document.documentElement.className = "";
});

test("mounts demo cursor and body class when demo query is enabled", () => {
    mockDemoModeValue = true;
    render(
        <AppShell>
            <div>Page content</div>
        </AppShell>
    );

    expect(screen.getByTestId("demo-cursor")).not.toBeNull();
    expect(document.body.classList.contains("demo-mode")).toBe(true);
});

test("does not mount demo cursor outside demo mode", () => {
    mockDemoModeValue = false;
    render(
        <AppShell>
            <div>Page content</div>
        </AppShell>
    );

    expect(screen.queryByTestId("demo-cursor")).toBeNull();
    expect(document.body.classList.contains("demo-mode")).toBe(false);
});
