#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const { resolvePlaywrightBrowserCli } = require("../lib/playwright");


function main() {
    try {
        const playwrightCliPath = resolvePlaywrightBrowserCli();
        const result = spawnSync(
            process.execPath,
            [playwrightCliPath, "install", "chromium"],
            {
                stdio: "inherit",
                env: process.env,
                cwd: path.resolve(__dirname, "..", ".."),
            },
        );

        process.exit(result.status || 0);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

main();
