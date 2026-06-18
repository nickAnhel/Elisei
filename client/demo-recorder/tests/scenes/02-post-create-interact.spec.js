const { test, expect } = require("../scene-test");

const {
    buildSceneContent,
    humanClick,
    humanFill,
    humanPause,
    markScene,
    prepareDemoPage,
    resolveMaterialPath,
    smoothScroll,
    smoothScrollLocator,
    smoothScrollLocatorToBottom,
    typeTagList,
} = require("../../lib/scene");

async function didPostPublishFlowStart(page, postModal) {
    const submitButton = postModal.getByTestId("post-submit-button");
    const currentUrl = new URL(page.url());
    const saveError = page.locator(".post-save-error").first();

    if (currentUrl.searchParams.has("p") && /^\/people\/@/i.test(currentUrl.pathname)) {
        return true;
    }

    if (await submitButton.count() > 0) {
        const ariaBusy = await submitButton.getAttribute("aria-busy");
        if (ariaBusy === "true" || await submitButton.isDisabled()) {
            return true;
        }
    }

    if (await saveError.count() > 0) {
        const text = ((await saveError.textContent()) || "").trim();
        if (text) {
            return true;
        }
    }

    const detailCard = page.getByTestId("post-detail-card").first();
    if (await detailCard.count() > 0 && await detailCard.isVisible()) {
        return true;
    }

    return false;
}

async function triggerPostPublish(page, postModal) {
    const submitButton = postModal.getByTestId("post-submit-button");

    await humanClick(page, submitButton);

    try {
        await expect.poll(
            async () => didPostPublishFlowStart(page, postModal),
            { timeout: 2500 },
        ).toBe(true);
        return;
    } catch (_error) {
        await submitButton.click();
    }
}

async function waitForPostPublishOutcome(page, timeout = 60000) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        const currentUrl = new URL(page.url());
        const hasPostQuery = currentUrl.searchParams.has("p");
        const onProfilePage = /^\/people\/@/i.test(currentUrl.pathname);
        const postDetailsDialog = page.getByRole("dialog", { name: "Dialog" });
        const detailCard = postDetailsDialog.getByTestId("post-detail-card");

        if (hasPostQuery && onProfilePage) {
            return "details";
        }

        if (await detailCard.count() > 0 && await detailCard.first().isVisible()) {
            return "details";
        }

        const saveError = page.locator(".post-save-error").first();
        if (await saveError.count() > 0) {
            const text = ((await saveError.textContent()) || "").trim();
            if (text) {
                return `error:${text}`;
            }
        }

        await page.waitForTimeout(250);
    }

    return "pending";
}


test("02-post-create-interact", async ({ page, sceneRecorder }, testInfo) => {
    const content = buildSceneContent();

    await prepareDemoPage(page, "/feed");
    const createPostTrigger = page.getByTestId("create-post-trigger");
    await expect(createPostTrigger).toBeVisible();

    await sceneRecorder.start();
    await markScene(testInfo, "02-post-create-interact");
    await humanPause(page, 350);

    await humanClick(page, createPostTrigger);
    const postModal = page.getByRole("dialog", { name: "Dialog" });
    const postForm = postModal.locator("#create-post-form");
    const postContentInput = postModal.getByTestId("post-content-input");
    const submitButton = postModal.getByTestId("post-submit-button");

    await expect(postContentInput).toBeVisible();
    await humanPause(page, 400);
    await humanFill(page, postContentInput, content.post.text);
    await humanPause(page, 350);

    await postModal.getByTestId("post-media-input").setInputFiles([
        resolveMaterialPath("post", "image-1.png"),
        resolveMaterialPath("post", "image-2.png"),
    ]);

    await expect(postModal.locator(".post-media-composer-tile")).toHaveCount(2, { timeout: 30000 });
    await expect(postModal.locator(".post-media-status-chip")).toHaveCount(0, { timeout: 30000 });
    await humanPause(page, 400);

    await smoothScrollLocator(postForm, 260, 220);
    await humanPause(page, 180);
    await typeTagList(postModal, "post-tag-input-field", content.post.tags, { page, pauseMs: 120 });
    await smoothScrollLocatorToBottom(postForm, 340);

    await expect.poll(async () => submitButton.isEnabled()).toBe(true);
    await humanPause(page, 350);
    await triggerPostPublish(page, postModal);

    const publishOutcome = await waitForPostPublishOutcome(page, 60000);
    if (String(publishOutcome).startsWith("error:")) {
        throw new Error(`Post publish failed: ${String(publishOutcome).slice("error:".length)}`);
    }
    if (publishOutcome !== "details") {
        throw new Error(`Post publish timed out with outcome: ${publishOutcome}`);
    }

    const postDetailsDialog = page.getByRole("dialog", { name: "Dialog" });
    const detailCard = postDetailsDialog.getByTestId("post-detail-card");
    await expect(detailCard).toBeVisible({ timeout: 30000 });

    const postLikeButton = postDetailsDialog.getByTestId("post-like-button");
    const commentSection = postDetailsDialog.getByTestId("comment-section");
    const commentInput = postDetailsDialog.getByTestId("comment-composer-input");
    const commentSubmitButton = postDetailsDialog.getByTestId("comment-composer-submit");

    await expect(commentSection).toBeVisible({ timeout: 30000 });
    await humanPause(page, 700);

    await humanClick(page, postLikeButton, { xRatio: 0.35 });
    await expect(postLikeButton).toHaveAttribute("aria-label", "Remove like");
    await humanPause(page, 300);

    await humanFill(page, commentInput, content.post.comment);
    await humanPause(page, 250);
    await humanClick(page, commentSubmitButton, { xRatio: 0.35 });

    const latestCommentText = postDetailsDialog.getByText(content.post.comment, { exact: true }).first();
    await expect(latestCommentText).toBeVisible({ timeout: 30000 });
    await smoothScrollLocator(postDetailsDialog, 520, 220);
    await humanPause(page, 850);
    await page.waitForTimeout(1300);
});
