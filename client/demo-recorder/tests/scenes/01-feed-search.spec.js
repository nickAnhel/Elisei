const { test, expect } = require("../scene-test");

const {
    buildSceneContent,
    humanClick,
    humanFill,
    humanPause,
    markScene,
    prepareDemoPage,
    smoothScroll,
} = require("../../lib/scene");


test("01-feed-search", async ({ page, sceneRecorder }, testInfo) => {
    const content = buildSceneContent();

    await prepareDemoPage(page, "/feed");
    const searchInput = page.getByTestId("feed-search-input");
    await expect(searchInput).toBeVisible();
    await expect(page.getByTestId("create-post-trigger")).toBeVisible();

    await sceneRecorder.start();
    await markScene(testInfo, "01-feed-search");
    await humanPause(page, 175);

    await humanFill(page, searchInput, content.searchQuery, {
        preDelay: 2,
        postDelay: 4,
    });
    await humanPause(page, 175);
    await humanClick(page, page.getByTestId("feed-search-submit"), {
        steps: 1,
        preDelay: 2,
        clickDelay: 4,
        postDelay: 4,
    });

    await page.waitForURL(/\/search/i, { timeout: 30000 });
    await expect(page.getByTestId("search-results-list")).toBeVisible();
    await expect(page.getByTestId("search-result-item").first()).toBeVisible();
    await humanPause(page, 425);
    await smoothScroll(page, 1560, 1, 320);

    await page.waitForTimeout(1000);
});
