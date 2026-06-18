const fs = require("fs");

const { expect } = require("@playwright/test");

const { loadDemoContent, loadArticleTemplate } = require("./content");
const { loadDemoEnv } = require("./env");
const { resolveDemoPath } = require("./paths");


let cachedRunId = null;


function getRunId() {
    if (process.env.DEMO_RUN_ID) {
        return process.env.DEMO_RUN_ID;
    }

    if (!cachedRunId) {
        cachedRunId = `demo-${Date.now().toString(36)}`;
    }

    return cachedRunId;
}

function withRunSuffix(baseValue) {
    return baseValue;
}

function buildDemoUrl(relativePath = "/") {
    const env = loadDemoEnv();
    const url = new URL(relativePath, env.DEMO_BASE_URL);
    url.searchParams.set("demo", "1");
    return url.toString();
}

async function prepareDemoPage(page, relativePath = "/") {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
        window.localStorage.setItem("demoMode", "true");
        window.localStorage.setItem("elisei-theme-mode", "dark");
    });
    await page.goto(buildDemoUrl(relativePath), {
        waitUntil: "domcontentloaded",
    });
}

async function humanPause(page, duration = 20) {
    await page.waitForTimeout(duration);
}

async function ensureLocatorInView(page, locator, {
    block = "nearest",
    duration = 40,
    margin = 24,
} = {}) {
    const viewport = page.viewportSize();
    const box = await locator.boundingBox();

    if (!box || !viewport) {
        await locator.evaluate((element, nextBlock) => {
            element.scrollIntoView({
                behavior: "smooth",
                block: nextBlock,
                inline: "nearest",
            });
        }, block);
        await page.waitForTimeout(duration);
        return;
    }

    const isVisibleEnough = (
        box.y >= margin
        && box.x >= margin
        && (box.y + box.height) <= (viewport.height - margin)
        && (box.x + box.width) <= (viewport.width - margin)
    );

    if (isVisibleEnough) {
        return;
    }

    await locator.evaluate((element, nextBlock) => {
        element.scrollIntoView({
            behavior: "smooth",
            block: nextBlock,
            inline: "nearest",
        });
    }, block);
    await page.waitForTimeout(duration);
}

async function moveMouseToLocator(page, locator, {
    steps = 2,
    xRatio = 0.5,
    yRatio = 0.5,
} = {}) {
    await ensureLocatorInView(page, locator);
    const box = await locator.boundingBox();

    if (!box) {
        throw new Error("Unable to move mouse to an invisible target.");
    }

    const x = Math.round(box.x + (box.width * xRatio));
    const y = Math.round(box.y + (box.height * yRatio));
    await page.mouse.move(x, y, { steps });
    return { x, y };
}

async function humanClick(page, locator, {
    button = "left",
    steps = 2,
    preDelay = 3,
    clickDelay = 6,
    postDelay = 5,
    xRatio = 0.5,
    yRatio = 0.5,
} = {}) {
    const point = await moveMouseToLocator(page, locator, {
        steps,
        xRatio,
        yRatio,
    });
    await page.waitForTimeout(preDelay);
    await page.mouse.click(point.x, point.y, {
        button,
        delay: clickDelay,
    });
    await page.waitForTimeout(postDelay);
}

async function humanFill(page, locator, value, {
    preDelay = 4,
    postDelay = 7,
} = {}) {
    await humanClick(page, locator, {
        preDelay,
        postDelay: 4,
    });
    await locator.fill(value);
    await page.waitForTimeout(postDelay);
}

async function typeTagList(scope, inputTestId, tags, options = {}) {
    const pauseMs = options.pauseMs || 12;
    const pausePage = options.page || null;

    for (const tag of tags) {
        await expect(async () => {
            const field = scope.getByTestId(inputTestId);
            await field.click();
            await field.fill(tag);
            await field.press("Enter");
            await expect(scope.getByText(`#${tag}`, { exact: true })).toBeVisible();
        }).toPass({ timeout: 30000 });
        if (pausePage) {
            await humanPause(pausePage, pauseMs);
        }
    }
}

async function runSmoothPageScroll(page, distance, duration) {
    await page.evaluate(async (payload) => {
        const isScrollable = (element) => {
            if (!element || !(element instanceof HTMLElement)) {
                return false;
            }

            const style = window.getComputedStyle(element);
            const overflowY = style.overflowY;
            if (!/(auto|scroll|overlay)/.test(overflowY)) {
                return false;
            }

            return element.scrollHeight > element.clientHeight + 8;
        };

        const pickScrollableElement = () => {
            const preferredSelectors = [
                "#feed",
                "#user-details",
                "#post-details",
                "#article-editor-page",
                "#article-details",
                "#search-results-page",
                ".video-details-page",
                ".app-shell__content",
            ];

            for (const selector of preferredSelectors) {
                const element = document.querySelector(selector);
                if (isScrollable(element)) {
                    return element;
                }
            }

            const probe = document.elementFromPoint(
                Math.min(window.innerWidth - 24, Math.round(window.innerWidth * 0.68)),
                Math.round(window.innerHeight * 0.5),
            );

            let current = probe;
            while (current) {
                if (isScrollable(current)) {
                    return current;
                }
                current = current.parentElement;
            }

            const appShellContent = document.querySelector(".app-shell__content");
            if (isScrollable(appShellContent)) {
                return appShellContent;
            }

            const scrollableDescendants = Array.from(
                document.querySelectorAll("main *, [id]")
            ).filter((element) => isScrollable(element));

            if (scrollableDescendants.length > 0) {
                return scrollableDescendants.sort((left, right) => {
                    const leftDelta = left.scrollHeight - left.clientHeight;
                    const rightDelta = right.scrollHeight - right.clientHeight;
                    return rightDelta - leftDelta;
                })[0];
            }

            return null;
        };

        const targetElement = pickScrollableElement();
        const startTime = performance.now();
        const startPosition = targetElement ? targetElement.scrollTop : window.scrollY;
        const maxScrollTop = targetElement
            ? Math.max(targetElement.scrollHeight - targetElement.clientHeight, 0)
            : Math.max((document.scrollingElement || document.documentElement).scrollHeight - window.innerHeight, 0);
        const targetPosition = Math.max(0, Math.min(startPosition + payload.distance, maxScrollTop));
        const easeInOutCubic = (value) => (
            value < 0.5
                ? 4 * value * value * value
                : 1 - Math.pow(-2 * value + 2, 3) / 2
        );

        await new Promise((resolve) => {
            const frame = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / payload.duration, 1);
                const easedProgress = easeInOutCubic(progress);
                const nextPosition = startPosition + ((targetPosition - startPosition) * easedProgress);

                if (targetElement) {
                    targetElement.scrollTop = nextPosition;
                } else {
                    window.scrollTo(0, nextPosition);
                }

                if (progress < 1) {
                    requestAnimationFrame(frame);
                    return;
                }

                resolve();
            };

            requestAnimationFrame(frame);
        });
    }, {
        distance,
        duration,
    });
}

async function runSmoothElementScroll(locator, distance, duration) {
    await locator.evaluate(async (target, payload) => {
        const startTime = performance.now();
        const startPosition = target.scrollTop;
        const targetPosition = startPosition + payload.distance;
        const easeInOutCubic = (value) => (
            value < 0.5
                ? 4 * value * value * value
                : 1 - Math.pow(-2 * value + 2, 3) / 2
        );

        await new Promise((resolve) => {
            const frame = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / payload.duration, 1);
                const easedProgress = easeInOutCubic(progress);
                target.scrollTop = startPosition + ((targetPosition - startPosition) * easedProgress);

                if (progress < 1) {
                    requestAnimationFrame(frame);
                    return;
                }

                resolve();
            };

            requestAnimationFrame(frame);
        });
    }, {
        distance,
        duration,
    });
}

async function smoothScroll(page, distance = 800, steps = 12, stepDelay = 110) {
    const duration = Math.max(steps * stepDelay, 120);
    await runSmoothPageScroll(page, distance, duration);
}

async function smoothScrollLocator(locator, distance = 600, duration = 180) {
    await runSmoothElementScroll(locator, distance, duration);
}

async function smoothScrollLocatorToBottom(locator, duration = 420) {
    const scrollDistance = await locator.evaluate((target) => (
        Math.max(target.scrollHeight - target.clientHeight - target.scrollTop, 0)
    ));

    if (scrollDistance <= 0) {
        return;
    }

    await smoothScrollLocator(locator, scrollDistance, duration);
}

async function smoothScrollToBottom(page, duration = 420) {
    const scrollDistance = await page.evaluate(() => {
        const metrics = (() => {
            const isScrollable = (element) => {
                if (!element || !(element instanceof HTMLElement)) {
                    return false;
                }

                const style = window.getComputedStyle(element);
                const overflowY = style.overflowY;
                if (!/(auto|scroll|overlay)/.test(overflowY)) {
                    return false;
                }

                return element.scrollHeight > element.clientHeight + 8;
            };

            const probe = document.elementFromPoint(
                Math.min(window.innerWidth - 24, Math.round(window.innerWidth * 0.68)),
                Math.round(window.innerHeight * 0.5),
            );

            let current = probe;
            while (current) {
                if (isScrollable(current)) {
                    return {
                        scrollTop: current.scrollTop,
                        maxScrollTop: Math.max(current.scrollHeight - current.clientHeight, 0),
                    };
                }
                current = current.parentElement;
            }

            const appShellContent = document.querySelector(".app-shell__content");
            if (isScrollable(appShellContent)) {
                return {
                    scrollTop: appShellContent.scrollTop,
                    maxScrollTop: Math.max(appShellContent.scrollHeight - appShellContent.clientHeight, 0),
                };
            }

            const scrollingElement = document.scrollingElement || document.documentElement;
            return {
                scrollTop: window.scrollY,
                maxScrollTop: Math.max(scrollingElement.scrollHeight - window.innerHeight, 0),
            };
        })();

        return Math.max(metrics.maxScrollTop - metrics.scrollTop, 0);
    });

    if (scrollDistance <= 0) {
        return;
    }

    await smoothScroll(page, scrollDistance, 1, duration);
}

async function markScene(testInfo, sceneId, payload = {}) {
    const sceneMarkerPath = testInfo.outputPath("scene.json");
    fs.writeFileSync(sceneMarkerPath, JSON.stringify({
        sceneId,
        ...payload,
    }, null, 2));
}

async function waitForStableValue(producer, matcher, timeout = 30000) {
    await expect.poll(producer, { timeout }).toSatisfy(matcher);
}

async function selectCustomOption(page, label, optionLabel) {
    const field = page.getByLabel(label, { exact: true });
    const hasTargetValue = async () => {
        const value = (await field.textContent() || "").trim();
        return value === optionLabel;
    };

    if (await hasTargetValue()) {
        return;
    }

    await humanClick(page, field);
    const option = page.getByRole("option", { name: optionLabel, exact: true });
    await expect(option).toBeVisible();
    await option.click();

    if (await hasTargetValue()) {
        return;
    }

    await field.focus();
    for (let attempt = 0; attempt < 5; attempt += 1) {
        await field.press("ArrowDown");
        await page.waitForTimeout(20);
        if (await hasTargetValue()) {
            await field.press("Enter");
            return;
        }
    }

    await expect.poll(async () => (await field.textContent() || "").trim(), {
        timeout: 5000,
    }).toBe(optionLabel);
}

function resolveMaterialPath(...segments) {
    return resolveDemoPath("materials", ...segments);
}

function buildSceneContent() {
    const content = loadDemoContent();

    return {
        searchQuery: content.search_query,
        post: {
            text: withRunSuffix(content.post.text),
            comment: withRunSuffix(content.post.comment),
            tags: content.post.tags || [],
        },
        article: {
            title: withRunSuffix(content.article.title),
            tags: content.article.tags || [],
            template: loadArticleTemplate(),
        },
        video: {
            title: withRunSuffix(content.video.title),
            description: withRunSuffix(content.video.description),
            tags: content.video.tags || [],
        },
        messenger: {
            text: withRunSuffix(content.messenger.text),
            attachmentsText: withRunSuffix(content.messenger.attachments_text),
            replyText: withRunSuffix(content.messenger.reply_text),
        },
        selectors: content.selectors || {},
    };
}

module.exports = {
    buildDemoUrl,
    buildSceneContent,
    getRunId,
    humanClick,
    humanFill,
    humanPause,
    markScene,
    moveMouseToLocator,
    prepareDemoPage,
    resolveMaterialPath,
    smoothScroll,
    smoothScrollLocator,
    smoothScrollLocatorToBottom,
    smoothScrollToBottom,
    selectCustomOption,
    typeTagList,
    waitForStableValue,
    withRunSuffix,
};
