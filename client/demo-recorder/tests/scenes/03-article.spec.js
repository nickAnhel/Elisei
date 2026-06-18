const { test, expect } = require("../scene-test");

const {
    buildSceneContent,
    humanClick,
    humanFill,
    humanPause,
    markScene,
    prepareDemoPage,
    resolveMaterialPath,
    selectCustomOption,
    smoothScrollLocator,
    smoothScrollLocatorToBottom,
    typeTagList,
} = require("../../lib/scene");

const ARTICLE_IMAGE_1_PLACEHOLDER = "{{ARTICLE_IMAGE_1}}";
const ARTICLE_IMAGE_2_PLACEHOLDER = "{{ARTICLE_IMAGE_2}}";
const PLATFORM_VIDEO_PLACEHOLDER = "{{PLATFORM_VIDEO_DIRECTIVE}}";


function countDirectiveLines(value, prefix) {
    return (value || "")
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.startsWith(prefix))
        .length;
}

async function triggerArticlePublish(page) {
    const publishButton = page.getByTestId("article-publish-button");
    const statusLabel = page.locator(".article-editor-status span").first();

    await humanClick(page, publishButton);

    try {
        await expect.poll(async () => ((await statusLabel.textContent()) || "").trim(), {
            timeout: 2500,
        }).not.toBe("Draft not saved yet");
        return;
    } catch (error) {
        await publishButton.click();
    }
}

async function waitForArticlePublishOutcome(page, articleDetailsPage, timeout = 90000) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        const pathname = new URL(page.url()).pathname;

        if (/^\/articles\/[^/]+$/i.test(pathname) && pathname !== "/articles/new") {
            return "details";
        }

        const saveError = page.locator(".article-editor-error").first();
        if (await saveError.count() > 0) {
            const text = ((await saveError.textContent()) || "").trim();
            if (text) {
                return `error:${text}`;
            }
        }

        const statusLabel = page.locator(".article-editor-status span").first();
        if (await statusLabel.count() > 0) {
            const value = ((await statusLabel.textContent()) || "").trim();
            if (value === "Save failed") {
                return "error:Save failed";
            }
        }

        if (await articleDetailsPage.count() > 0 && await articleDetailsPage.isVisible()) {
            return "details";
        }

        await page.waitForTimeout(250);
    }

    return "pending";
}

async function selectBodyPlaceholder(page, placeholder) {
    const bodyInput = page.getByTestId("article-body-input");
    await bodyInput.focus();

    const found = await bodyInput.evaluate((textarea, token) => {
        const start = textarea.value.indexOf(token);

        if (start === -1) {
            return false;
        }

        const end = start + token.length;
        textarea.focus();
        textarea.setSelectionRange(start, end);
        return true;
    }, placeholder);

    expect(found).toBe(true);
    await humanPause(page, 20);
}

async function replacePlaceholderWithAsset(page, {
    placeholder,
    inputTestId,
    directivePrefix,
    filePath,
}) {
    const bodyInput = page.getByTestId("article-body-input");
    const beforeValue = await bodyInput.inputValue();
    const beforeCount = countDirectiveLines(beforeValue, directivePrefix);

    await selectBodyPlaceholder(page, placeholder);
    await page.getByTestId(inputTestId).setInputFiles(filePath);

    await expect.poll(async () => {
        const bodyValue = await bodyInput.inputValue();
        return JSON.stringify({
            containsPlaceholder: bodyValue.includes(placeholder),
            directiveCount: countDirectiveLines(bodyValue, directivePrefix),
        });
    }, { timeout: 60000 }).toBe(JSON.stringify({
        containsPlaceholder: false,
        directiveCount: beforeCount + 1,
    }));

    await humanPause(page, 25);
}

async function replacePlaceholderWithPlatformVideo(page, placeholder) {
    const bodyInput = page.getByTestId("article-body-input");
    const beforeValue = await bodyInput.inputValue();
    const beforeCount = countDirectiveLines(beforeValue, "::platform_video{");
    const toolbar = page.getByRole("toolbar", { name: /article markdown formatting/i });

    await selectBodyPlaceholder(page, placeholder);
    await humanClick(page, toolbar.getByRole("button", { name: "Insert video", exact: true }), {
        xRatio: 0.35,
    });
    await expect(page.getByTestId("article-platform-video-link-input")).toBeVisible();
    await humanPause(page, 25);

    const option = page.getByTestId("article-platform-video-option").first();
    await expect(option).toBeVisible({ timeout: 30000 });
    await humanClick(page, option, {
        xRatio: 0.25,
        yRatio: 0.4,
    });

    await expect.poll(async () => {
        const bodyValue = await bodyInput.inputValue();
        return JSON.stringify({
            containsPlaceholder: bodyValue.includes(placeholder),
            directiveCount: countDirectiveLines(bodyValue, "::platform_video{"),
        });
    }, { timeout: 60000 }).toBe(JSON.stringify({
        containsPlaceholder: false,
        directiveCount: beforeCount + 1,
    }));

    await humanPause(page, 30);
}

test("03-article", async ({ page, sceneRecorder }, testInfo) => {
    const content = buildSceneContent();
    const articleEditorPage = page.locator("#article-editor-page");
    const articleDetailsPage = page.getByTestId("article-details-page");

    await prepareDemoPage(page, "/articles/new");
    await expect(page.getByTestId("article-title-input")).toBeVisible();

    await humanFill(page, page.getByTestId("article-title-input"), content.article.title);
    await selectCustomOption(page, "Status", "Published");
    await expect(page.getByLabel("Status", { exact: true })).toContainText("Published");
    await selectCustomOption(page, "Visibility", "Public");
    await page.getByTestId("article-cover-input").setInputFiles(resolveMaterialPath("article", "image-1.png"));
    await typeTagList(page, "article-tag-input-field", content.article.tags, { page, pauseMs: 10 });

    const bodyInput = page.getByTestId("article-body-input");
    await humanFill(page, bodyInput, content.article.template);
    await replacePlaceholderWithAsset(page, {
        placeholder: ARTICLE_IMAGE_1_PLACEHOLDER,
        inputTestId: "article-inline-image-input",
        directivePrefix: "::image{",
        filePath: resolveMaterialPath("article", "image-1.png"),
    });
    await selectBodyPlaceholder(page, ARTICLE_IMAGE_2_PLACEHOLDER);
    await articleEditorPage.evaluate((node) => {
        node.scrollTop = 0;
    });

    await sceneRecorder.start();
    await markScene(testInfo, "03-article");
    await humanPause(page, 500);
    await smoothScrollLocator(articleEditorPage, 760, 420);
    await humanPause(page, 250);

    await replacePlaceholderWithAsset(page, {
        placeholder: ARTICLE_IMAGE_2_PLACEHOLDER,
        inputTestId: "article-inline-image-input",
        directivePrefix: "::image{",
        filePath: resolveMaterialPath("article", "image-2.png"),
    });
    await humanPause(page, 450);

    await replacePlaceholderWithPlatformVideo(page, PLATFORM_VIDEO_PLACEHOLDER);
    await humanPause(page, 350);
    await smoothScrollLocatorToBottom(articleEditorPage, 700);

    await expect(page.getByTestId("article-publish-button")).toContainText("Publish / Update");
    await triggerArticlePublish(page);
    const publishOutcome = await waitForArticlePublishOutcome(page, articleDetailsPage, 90000);

    if (String(publishOutcome).startsWith("error:")) {
        throw new Error(`Article publish failed: ${String(publishOutcome).slice("error:".length)}`);
    }
    if (publishOutcome !== "details") {
        throw new Error(`Article publish timed out with outcome: ${publishOutcome}`);
    }

    await page.waitForURL((url) => {
        const pathname = new URL(url).pathname;
        return /^\/articles\/[^/]+$/i.test(pathname) && pathname !== "/articles/new";
    }, { timeout: 90000 });
    await expect(articleDetailsPage).toBeVisible({ timeout: 90000 });
    await expect(articleDetailsPage.getByRole("heading", {
        name: content.article.title,
        level: 1,
    })).toHaveText(content.article.title);
    await articleDetailsPage.evaluate((node) => {
        node.scrollTop = 0;
    });
    await humanPause(page, 500);
    await smoothScrollLocatorToBottom(articleDetailsPage, 1400);

    await page.waitForTimeout(1300);
});
