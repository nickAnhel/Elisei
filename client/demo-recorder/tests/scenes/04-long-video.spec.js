const { test, expect } = require("../scene-test");

const {
    buildSceneContent,
    humanClick,
    humanFill,
    humanPause,
    markScene,
    moveMouseToLocator,
    prepareDemoPage,
    resolveMaterialPath,
    selectCustomOption,
    typeTagList,
} = require("../../lib/scene");

async function waitForVideoEditorReady(page, timeout = 180000) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        const sourceStatus = ((await page.locator(".video-asset-status-item").first().locator(".video-asset-status-value").textContent()) || "").trim();
        const watchSurfaceReady = await page.getByTestId("video-publish-button").isEnabled();

        if (watchSurfaceReady && sourceStatus === "Ready") {
            return;
        }

        await page.waitForTimeout(5000);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("video-publish-button")).toBeVisible();
    }

    throw new Error("Timed out waiting for the prepared video draft to become ready.");
}


test("04-long-video", async ({ page, sceneRecorder }, testInfo) => {
    const content = buildSceneContent();
    const editorPreviewVideo = page.locator(".video-frame-picker video").first();

    await prepareDemoPage(page, "/videos/new");
    await expect(page.getByTestId("video-source-input")).toBeVisible();

    await page.getByTestId("video-source-input").setInputFiles(resolveMaterialPath("video", "long-video.mp4"));
    await page.getByTestId("video-cover-input").setInputFiles(resolveMaterialPath("video", "cover.png"));
    await humanFill(page, page.getByTestId("video-title-input"), content.video.title);
    await humanFill(page, page.getByTestId("video-description-input"), content.video.description);
    await selectCustomOption(page, "Visibility", "Public");
    await typeTagList(page, "video-tag-input-field", content.video.tags, { page, pauseMs: 10 });

    await expect.poll(async () => page.getByTestId("video-publish-button").isEnabled(), {
        timeout: 120000,
    }).toBe(true);
    await humanClick(page, page.getByRole("button", { name: "Save draft" }));
    await page.waitForURL(/\/videos\/[0-9a-f-]+\/edit$/i, { timeout: 120000 });
    await waitForVideoEditorReady(page);
    await expect(editorPreviewVideo).toBeVisible({ timeout: 30000 });

    await sceneRecorder.start();
    await markScene(testInfo, "04-long-video");
    await humanPause(page, 2000);

    await humanClick(page, page.getByTestId("video-publish-button"));
    await page.waitForURL(/\/videos\/[0-9a-f-]+$/i, { timeout: 300000 });

    const videoDetailsPage = page.getByTestId("video-details-page");
    const videoWatchSurface = page.getByTestId("video-watch-surface");
    const videoElement = videoWatchSurface.locator("video").first();

    await expect(videoDetailsPage).toBeVisible();
    await expect(videoWatchSurface).toBeVisible();
    await expect(videoElement).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => ((await videoElement.getAttribute("poster")) || "").trim(), {
        timeout: 30000,
    }).not.toBe("");
    await expect(page.getByRole("heading", { name: content.video.title, level: 1 })).toBeVisible();

    await humanPause(page, 700);
    await moveMouseToLocator(page, videoWatchSurface, {
        xRatio: 0.5,
        yRatio: 0.55,
    });
    await humanPause(page, 120);
    await humanClick(page, page.getByRole("button", { name: "Play video" }), {
        xRatio: 0.5,
    });
    await expect.poll(async () => videoElement.evaluate((node) => node.paused)).toBe(false);
    await page.waitForTimeout(1000);
});
