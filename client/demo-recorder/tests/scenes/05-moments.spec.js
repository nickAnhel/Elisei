const { test, expect } = require("../scene-test");

const {
    humanClick,
    humanPause,
    markScene,
    prepareDemoPage,
} = require("../../lib/scene");


test("05-moments", async ({ page, sceneRecorder }, testInfo) => {
    await prepareDemoPage(page, "/moments");
    await expect(page.getByTestId("moment-slide").first()).toBeVisible();
    await expect(page.locator('[data-testid="moment-slide"][data-active="true"]').first()).toBeVisible();
    await expect(page.locator(".video-player-spinner")).toHaveCount(0, { timeout: 30000 });

    await sceneRecorder.start();
    await markScene(testInfo, "05-moments");
    await humanPause(page, 700);

    await humanClick(page, page.getByTestId("moments-next-button"));
    await page.waitForTimeout(650);
    await humanClick(page, page.getByTestId("moments-next-button"));
    await page.waitForTimeout(650);
    await humanClick(page, page.getByTestId("moments-next-button"));
    await page.waitForTimeout(700);

    await page.waitForTimeout(1300);
});
