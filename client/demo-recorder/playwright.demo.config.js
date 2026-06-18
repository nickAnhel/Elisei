const { defineConfig } = require("@playwright/test");

const { loadDemoEnv } = require("./lib/env");
const { resolveDemoPath } = require("./lib/paths");


const env = loadDemoEnv();

module.exports = defineConfig({
    testDir: resolveDemoPath("tests"),
    timeout: 300000,
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"]],
    outputDir: resolveDemoPath("test-results"),
    use: {
        baseURL: env.DEMO_BASE_URL,
        viewport: {
            width: 1920,
            height: 1080,
        },
        colorScheme: "dark",
        video: "off",
        trace: "off",
        screenshot: "off",
        headless: true,
        storageState: resolveDemoPath(".auth", "demo-user.json"),
        launchOptions: {
            slowMo: Number(env.DEMO_ACTION_DELAY_MS || 180),
            args: [],
        },
    },
});
