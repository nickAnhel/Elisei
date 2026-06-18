const fs = require("fs");

const { test, expect } = require("@playwright/test");

const { loadDemoEnv } = require("../lib/env");
const { prepareDemoPage } = require("../lib/scene");
const { resolveDemoPath } = require("../lib/paths");


test.use({
    storageState: {
        cookies: [],
        origins: [],
    },
});

test("authenticate demo user", async ({ page }) => {
    const env = loadDemoEnv({ requireAuth: true });
    const authDirectory = resolveDemoPath(".auth");
    fs.mkdirSync(authDirectory, { recursive: true });

    await prepareDemoPage(page, "/login");
    await page.getByLabel("Username").fill(env.DEMO_USER_LOGIN);
    await page.getByLabel("Password").fill(env.DEMO_USER_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
        timeout: 30000,
    });
    await expect(page.locator("[data-demo-mode='true']")).toBeVisible();

    await page.context().storageState({
        path: resolveDemoPath(".auth", "demo-user.json"),
    });
});
