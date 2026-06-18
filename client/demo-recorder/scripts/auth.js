#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const { ensureDemoBaseUrlReachable } = require("../lib/base-url");
const { loadDemoEnv } = require("../lib/env");
const { resolveDemoPath } = require("../lib/paths");
const {
    ensureChromiumInstalled,
    resolvePlaywrightBrowserCli,
    resolvePlaywrightTestCli,
} = require("../lib/playwright");


function runDemoAuthSetup(env = loadDemoEnv({ requireAuth: true })) {
    const playwrightCliPath = resolvePlaywrightTestCli();
    const playwrightBrowserCliPath = resolvePlaywrightBrowserCli();
    ensureChromiumInstalled(playwrightBrowserCliPath);

    return spawnSync(
        process.execPath,
        [
            playwrightCliPath,
            "test",
            "--config",
            resolveDemoPath("playwright.demo.config.js"),
            resolveDemoPath("tests", "auth.setup.spec.js"),
        ],
        {
            stdio: "inherit",
            env: {
                ...process.env,
                DEMO_BASE_URL: env.DEMO_BASE_URL,
                DEMO_USER_LOGIN: env.DEMO_USER_LOGIN,
                DEMO_USER_PASSWORD: env.DEMO_USER_PASSWORD,
            },
            cwd: path.resolve(__dirname, "..", ".."),
        },
    );
}

async function main() {
    try {
        const env = loadDemoEnv({ requireAuth: true });
        await ensureDemoBaseUrlReachable(env.DEMO_BASE_URL);
        const result = runDemoAuthSetup(env);
        process.exit(result.status || 0);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    runDemoAuthSetup,
};
