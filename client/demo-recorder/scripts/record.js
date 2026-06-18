#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { validateAuthState } = require("../lib/auth-state");
const { ensureDemoBaseUrlReachable } = require("../lib/base-url");
const { loadDemoEnv } = require("../lib/env");
const { ensureFfmpegInstalled } = require("../lib/ffmpeg");
const { getRunId } = require("../lib/scene");
const { resolveDemoPath } = require("../lib/paths");
const { runDemoAuthSetup } = require("./auth");
const {
    ensureChromiumInstalled,
    resolvePlaywrightBrowserCli,
    resolvePlaywrightTestCli,
} = require("../lib/playwright");


function listFilesRecursively(rootPath) {
    if (!fs.existsSync(rootPath)) {
        return [];
    }

    return fs.readdirSync(rootPath, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(rootPath, entry.name);
        if (entry.isDirectory()) {
            return listFilesRecursively(entryPath);
        }
        return [entryPath];
    });
}

function collectRawVideos() {
    const testResultsPath = resolveDemoPath("test-results");
    const rawOutputPath = resolveDemoPath("out", "raw");
    fs.mkdirSync(rawOutputPath, { recursive: true });

    const files = listFilesRecursively(testResultsPath);
    const sceneMarkerPaths = files.filter((filePath) => filePath.endsWith("scene.json"));

    sceneMarkerPaths.forEach((markerPath) => {
        const scene = JSON.parse(fs.readFileSync(markerPath, "utf8"));
        const sceneDirectory = path.dirname(markerPath);
        const sceneFiles = listFilesRecursively(sceneDirectory);
        const preferredCandidates = [
            path.join(sceneDirectory, "video.mp4"),
            path.join(sceneDirectory, "video.webm"),
        ];
        const videoPath = preferredCandidates.find((candidate) => fs.existsSync(candidate))
            || sceneFiles.find((filePath) => /\.(mp4|webm)$/i.test(filePath));

        if (!videoPath) {
            return;
        }

        const targetExtension = path.extname(videoPath);
        const targetPath = path.join(rawOutputPath, `${scene.sceneId}${targetExtension}`);
        [".mp4", ".webm"].forEach((extension) => {
            const stalePath = path.join(rawOutputPath, `${scene.sceneId}${extension}`);
            if (extension !== targetExtension && fs.existsSync(stalePath)) {
                fs.rmSync(stalePath, { force: true });
            }
        });
        fs.copyFileSync(videoPath, targetPath);
    });
}

async function main() {
    try {
        const env = loadDemoEnv({ requireAuth: true });
        ensureFfmpegInstalled("npm run demo:record");
        const playwrightCliPath = resolvePlaywrightTestCli();
        const playwrightBrowserCliPath = resolvePlaywrightBrowserCli();
        ensureChromiumInstalled(playwrightBrowserCliPath);
        await ensureDemoBaseUrlReachable(env.DEMO_BASE_URL);

        const authStatePath = resolveDemoPath(".auth", "demo-user.json");
        const authValidation = validateAuthState({
            authStatePath,
            baseUrl: env.DEMO_BASE_URL,
        });

        if (!authValidation.ok) {
            console.warn(
                [
                    authValidation.message,
                    "Refreshing demo auth state before recording...",
                ].join("\n"),
            );

            const authResult = runDemoAuthSetup(env);
            if ((authResult.status || 0) !== 0) {
                process.exit(authResult.status || 1);
            }
        }

        const result = spawnSync(
            process.execPath,
            [
                playwrightCliPath,
                "test",
                "--config",
                resolveDemoPath("playwright.demo.config.js"),
                resolveDemoPath("tests", "scenes"),
                ...process.argv.slice(2),
            ],
            {
                stdio: "inherit",
                env: {
                    ...process.env,
                    DEMO_RUN_ID: process.env.DEMO_RUN_ID || getRunId(),
                },
                cwd: path.resolve(__dirname, "..", ".."),
            },
        );

        collectRawVideos();
        process.exit(result.status || 0);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

main();
