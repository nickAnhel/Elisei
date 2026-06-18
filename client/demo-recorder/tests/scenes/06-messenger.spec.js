const { test, expect } = require("../scene-test");

const {
    buildSceneContent,
    humanClick,
    humanFill,
    humanPause,
    markScene,
    prepareDemoPage,
    resolveMaterialPath,
} = require("../../lib/scene");

function findLatestChatMessageByText(page, text) {
    return page.getByTestId("chat-message").filter({
        has: page.getByText(text, { exact: true }),
    }).last();
}


test("06-messenger", async ({ page, sceneRecorder }, testInfo) => {
    const content = buildSceneContent();
    const fileAttachmentText = `${content.messenger.attachmentsText} File attachment.`;
    const chatBody = page.locator(".chat-body");

    await prepareDemoPage(page, "/chats");
    await expect(page.getByTestId("chat-list")).toBeVisible();

    const chatListItem = page.getByTestId("chat-list-item").filter({
        has: page.getByText("Commenter Product Ux 050", { exact: true }),
    }).first();

    await expect(chatListItem).toBeVisible({ timeout: 30000 });
    await humanClick(page, chatListItem, {
        xRatio: 0.35,
    });

    await expect(page.getByTestId("chat-composer")).toBeVisible();
    await expect(chatBody).toBeVisible();
    await chatBody.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
    });

    await sceneRecorder.start();
    await markScene(testInfo, "06-messenger");
    await humanPause(page, 105);

    await humanFill(page, page.getByTestId("chat-message-input"), content.messenger.text);
    await humanPause(page, 75);
    await humanClick(page, page.getByTestId("chat-send-button"));
    await expect(findLatestChatMessageByText(page, content.messenger.text)).toBeVisible({ timeout: 30000 });
    await humanPause(page, 150);

    await page.getByTestId("chat-attachment-input").setInputFiles([
        resolveMaterialPath("messenger", "image-1.png"),
        resolveMaterialPath("messenger", "image-2.png"),
        resolveMaterialPath("messenger", "attachment.pdf"),
    ]);
    await humanFill(page, page.getByTestId("chat-message-input"), fileAttachmentText);
    await expect.poll(async () => page.getByTestId("chat-send-button").isEnabled(), { timeout: 60000 }).toBe(true);
    await humanPause(page, 75);
    await humanClick(page, page.getByTestId("chat-send-button"));
    await expect(findLatestChatMessageByText(page, fileAttachmentText)).toBeVisible({ timeout: 30000 });
    await humanPause(page, 180);

    const latestAttachmentMessage = findLatestChatMessageByText(page, fileAttachmentText);
    await humanClick(page, latestAttachmentMessage, {
        button: "right",
        preDelay: 3,
        postDelay: 5,
        xRatio: 0.42,
    });
    await expect(page.getByTestId("message-context-menu")).toBeVisible();
    await humanPause(page, 105);
    await humanClick(page, page.getByTestId("message-reply-action"), {
        xRatio: 0.25,
    });
    await expect(page.getByTestId("chat-reply-banner")).toBeVisible();
    await humanPause(page, 105);

    await humanFill(page, page.getByTestId("chat-message-input"), content.messenger.replyText);
    await humanPause(page, 105);
    await humanClick(page, page.getByTestId("chat-send-button"));
    const latestReplyMessage = findLatestChatMessageByText(page, content.messenger.replyText);
    await expect(latestReplyMessage).toBeVisible({ timeout: 30000 });
    await humanPause(page, 210);

    await humanClick(page, latestAttachmentMessage, {
        button: "right",
        preDelay: 3,
        postDelay: 5,
        xRatio: 0.42,
    });
    await expect(page.getByTestId("message-context-menu")).toBeVisible();
    await humanPause(page, 105);
    await humanClick(page, page.getByTestId("message-reaction-like"), {
        xRatio: 0.25,
    });
    await expect(latestAttachmentMessage.getByLabel(/Like \d+/i)).toBeVisible({ timeout: 30000 });
    await humanPause(page, 270);
    await page.waitForTimeout(1300);
});
