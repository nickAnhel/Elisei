#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveDemoPath } = require("../lib/paths");
const {
    ensureFfmpegInstalled,
    getAvailableEncoders,
    runFfmpeg,
    selectAudioEncoder,
    selectVideoEncoder,
} = require("../lib/ffmpeg");


const SCENE_IDS = [
    "01-feed-search",
    "02-post-create-interact",
    "03-article",
    "04-long-video",
    "05-moments",
    "06-messenger",
];

function findRawScenePath(sceneId) {
    const rawDirectory = resolveDemoPath("out", "raw");
    const extensions = [".mp4", ".webm"];
    return extensions
        .map((extension) => path.join(rawDirectory, `${sceneId}${extension}`))
        .find((candidate) => fs.existsSync(candidate));
}

function main() {
    ensureFfmpegInstalled("npm run demo:build-video");
    const availableEncoders = getAvailableEncoders();
    const videoEncoder = selectVideoEncoder(availableEncoders);
    const audioEncoder = selectAudioEncoder(availableEncoders);

    console.log(`Using ffmpeg video encoder: ${videoEncoder.name}`);
    console.log(`Using ffmpeg audio encoder: ${audioEncoder.name}`);

    const sceneOutputDirectory = resolveDemoPath("out", "scenes");
    const finalOutputDirectory = resolveDemoPath("out", "final");
    fs.mkdirSync(sceneOutputDirectory, { recursive: true });
    fs.mkdirSync(finalOutputDirectory, { recursive: true });

    const producedScenePaths = [];

    SCENE_IDS.forEach((sceneId) => {
        const rawScenePath = findRawScenePath(sceneId);
        if (!rawScenePath) {
            throw new Error(`Missing raw scene video for ${sceneId}. Run \`npm run demo:record\` first.`);
        }

        const normalizedScenePath = path.join(sceneOutputDirectory, `${sceneId}.mp4`);
        runFfmpeg([
            "-y",
            "-i",
            rawScenePath,
            "-vf",
                "scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=25,setsar=1,format=yuv420p",
            ...videoEncoder.args,
            ...audioEncoder.args,
            normalizedScenePath,
        ]);
        producedScenePaths.push(normalizedScenePath);
    });

    const concatListPath = path.join(os.tmpdir(), `elisei-demo-scenes-${Date.now()}.txt`);
    fs.writeFileSync(
        concatListPath,
        producedScenePaths.map((scenePath) => `file '${scenePath.replace(/'/g, "'\\''")}'`).join("\n"),
    );

    runFfmpeg([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy",
        path.join(finalOutputDirectory, "diploma-demo-final.mp4"),
    ]);

    fs.unlinkSync(concatListPath);
}

main();
