const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");


function resolveFromClient(specifier) {
    try {
        return require.resolve(specifier, {
            paths: [path.resolve(__dirname, "..", "..")],
        });
    } catch (error) {
        return null;
    }
}

function resolvePackageFile(packageName, ...segments) {
    try {
        const packageJsonPath = require.resolve(`${packageName}/package.json`, {
            paths: [path.resolve(__dirname, "..", "..")],
        });
        return path.join(path.dirname(packageJsonPath), ...segments);
    } catch (error) {
        return null;
    }
}

function resolvePlaywrightTestCli() {
    return resolvePackageFile("@playwright/test", "cli.js") || resolvePlaywrightBrowserCli();
}

function resolvePlaywrightBrowserCli() {
    return resolvePackageFile("playwright", "cli.js");
}

function getPlaywrightExecutables() {
    const coreBundlePath = resolvePackageFile("playwright-core", "lib", "coreBundle.js");
    if (!coreBundlePath) {
        return [];
    }

    const coreBundle = require(coreBundlePath);
    const registry = coreBundle.registry?.registry;
    if (!registry || typeof registry.findExecutable !== "function") {
        return [];
    }

    return ["chromium-headless-shell", "ffmpeg"].map((name) => {
        const executable = registry.findExecutable(name);
        return {
            name,
            executablePath: executable?.executablePath?.() || null,
        };
    });
}

function getPathOwnerLabel(targetPath) {
    const result = spawnSync("stat", ["-c", "%U:%G", targetPath], {
        encoding: "utf8",
    });

    if (result.status !== 0) {
        return null;
    }

    return result.stdout.trim() || null;
}

function resolvePlaywrightCli() {
    const resolvedCliPath = resolvePlaywrightTestCli();

    if (resolvedCliPath) {
        return resolvedCliPath;
    }

    const clientRoot = path.resolve(__dirname, "..", "..");
    const nodeModulesPath = path.join(clientRoot, "node_modules");
    const helpLines = [
        "Playwright demo dependencies are not installed in client/node_modules.",
        "Run `npm ci` from `client/` to install the locked dependency set.",
    ];

    if (fs.existsSync(nodeModulesPath)) {
        try {
            fs.accessSync(nodeModulesPath, fs.constants.W_OK);
        } catch (error) {
            const ownerLabel = getPathOwnerLabel(nodeModulesPath);
            helpLines.push(
                `Detected permission issue: client/node_modules is not writable${ownerLabel ? ` (owner: ${ownerLabel})` : ""}.`,
                "Fix ownership, then reinstall dependencies:",
                "  sudo chown -R \"$USER\":\"$USER\" client/node_modules",
                "  cd client && npm ci",
            );
        }
    }

    helpLines.push("After that, rerun `npm run demo:auth`.");

    const resolutionError = new Error(helpLines.join("\n"));
    resolutionError.code = "PLAYWRIGHT_NOT_INSTALLED";
    throw resolutionError;
}

function ensureChromiumInstalled(playwrightCliPath) {
    const missingExecutables = getPlaywrightExecutables().filter(
        ({ executablePath }) => !executablePath || !fs.existsSync(executablePath),
    );

    if (missingExecutables.length === 0) {
        return;
    }

    const error = new Error(
        [
            "Playwright browser binaries are missing for the demo recorder.",
            "Install Chromium for Playwright, then rerun the command:",
            "  npm run demo:install-browsers",
            "Alternative:",
            "  npx playwright install chromium",
            "Missing executables:",
            ...missingExecutables.map(({ name, executablePath }) => `  ${name}: ${executablePath || "unresolved"}`),
        ].join("\n"),
    );
    error.code = "PLAYWRIGHT_BROWSER_MISSING";
    throw error;
}

module.exports = {
    ensureChromiumInstalled,
    resolvePlaywrightBrowserCli,
    resolvePlaywrightCli,
    resolvePlaywrightTestCli,
};
