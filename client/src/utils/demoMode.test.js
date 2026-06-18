const originalEnvValue = process.env.REACT_APP_DEMO_MODE;
const originalWindowLocation = window.location;

function setWindowLocation(search = "") {
    delete window.location;
    window.location = new URL(`https://elisei.test/${search ? `?${search}` : ""}`);
}

describe("isDemoMode", () => {
    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        process.env.REACT_APP_DEMO_MODE = "false";
        setWindowLocation();
    });

    afterAll(() => {
        process.env.REACT_APP_DEMO_MODE = originalEnvValue;
        window.location = originalWindowLocation;
    });

    test("returns true when demo query parameter is present", async () => {
        setWindowLocation("demo=1");
        const { isDemoMode } = await import("./demoModeCore");

        expect(isDemoMode()).toBe(true);
    });

    test("returns true when localStorage demo flag is set", async () => {
        localStorage.setItem("demoMode", "true");
        const { isDemoMode } = await import("./demoModeCore");

        expect(isDemoMode()).toBe(true);
    });

    test("returns true when demo env flag is enabled", async () => {
        process.env.REACT_APP_DEMO_MODE = "true";
        const { isDemoMode } = await import("./demoModeCore");

        expect(isDemoMode()).toBe(true);
    });

    test("returns false when no demo source is enabled", async () => {
        const { isDemoMode } = await import("./demoModeCore");

        expect(isDemoMode()).toBe(false);
    });
});
