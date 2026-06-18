const base = require("@playwright/test");

const { startHighQualitySceneVideoCapture } = require("../lib/high-quality-video");

const test = base.test.extend({
    sceneRecorder: async ({ page }, use, testInfo) => {
        let stopCapture = null;

        try {
            await use({
                start: async () => {
                    if (!stopCapture) {
                        stopCapture = await startHighQualitySceneVideoCapture(page, testInfo);
                    }
                },
            });
        } finally {
            if (stopCapture) {
                await stopCapture();
            }
        }
    },
});

module.exports = {
    test,
    expect: base.expect,
};
