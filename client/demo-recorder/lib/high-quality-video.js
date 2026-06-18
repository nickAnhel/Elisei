const fs = require("fs");
const path = require("path");

const {
    ensureFfmpegInstalled,
    getAvailableEncoders,
    runFfmpeg,
    selectVideoEncoder,
} = require("./ffmpeg");


const TARGET_FPS = 25;
const TARGET_VIEWPORT = {
    width: 1920,
    height: 1080,
};

function buildFrameDurations(frames) {
    if (frames.length === 0) {
        return [];
    }

    const normalizedTimestamps = frames.map((frame, index) => {
        if (Number.isFinite(frame.timestamp) && frame.timestamp > 0) {
            return frame.timestamp;
        }
        return index / TARGET_FPS;
    });

    return frames.map((frame, index) => {
        if (index === frames.length - 1) {
            return {
                ...frame,
                durationSeconds: 1 / TARGET_FPS,
            };
        }

        const rawDuration = normalizedTimestamps[index + 1] - normalizedTimestamps[index];
        return {
            ...frame,
            durationSeconds: Math.max(rawDuration, 1 / TARGET_FPS),
        };
    });
}

function buildConcatManifest(frames) {
    const timedFrames = buildFrameDurations(frames);
    const lines = [];

    timedFrames.forEach((frame) => {
        lines.push(`file '${frame.filePath.replace(/'/g, "'\\''")}'`);
        lines.push(`duration ${frame.durationSeconds.toFixed(6)}`);
    });

    const lastFrame = timedFrames[timedFrames.length - 1];
    if (lastFrame) {
        lines.push(`file '${lastFrame.filePath.replace(/'/g, "'\\''")}'`);
    }

    return lines.join("\n");
}

async function startHighQualitySceneVideoCapture(page, testInfo) {
    ensureFfmpegInstalled("npm run demo:record");

    const availableEncoders = getAvailableEncoders();
    const videoEncoder = selectVideoEncoder(availableEncoders);
    const framesDirectory = testInfo.outputPath("hq-video-frames");
    const manifestPath = testInfo.outputPath("hq-video-frames.txt");
    const outputPath = testInfo.outputPath("video.mp4");

    fs.mkdirSync(framesDirectory, { recursive: true });

    const session = await page.context().newCDPSession(page);
    const frames = [];
    let frameIndex = 0;
    let writeQueue = Promise.resolve();
    let listenerError = null;

    const handleFrame = ({ data, metadata, sessionId }) => {
        const filePath = path.join(framesDirectory, `frame-${String(frameIndex).padStart(6, "0")}.png`);
        frameIndex += 1;
        frames.push({
            filePath,
            timestamp: Number(metadata?.timestamp || 0),
        });

        const buffer = Buffer.from(data, "base64");
        writeQueue = writeQueue.then(() => fs.promises.writeFile(filePath, buffer)).catch((error) => {
            listenerError = error;
        });

        session.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    };

    session.on("Page.screencastFrame", handleFrame);
    await session.send("Page.startScreencast", {
        format: "png",
        everyNthFrame: 1,
        maxWidth: TARGET_VIEWPORT.width,
        maxHeight: TARGET_VIEWPORT.height,
    });

    return async () => {
        await session.send("Page.stopScreencast").catch(() => {});
        session.off("Page.screencastFrame", handleFrame);
        await writeQueue;

        if (listenerError) {
            throw listenerError;
        }

        if (frames.length === 0) {
            return null;
        }

        fs.writeFileSync(manifestPath, buildConcatManifest(frames));

        try {
            runFfmpeg([
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                manifestPath,
                "-vf",
                `fps=${TARGET_FPS},scale=${TARGET_VIEWPORT.width}:${TARGET_VIEWPORT.height}:flags=lanczos,setsar=1,format=yuv420p`,
                ...videoEncoder.args,
                outputPath,
            ]);
        } finally {
            fs.rmSync(framesDirectory, { recursive: true, force: true });
            fs.rmSync(manifestPath, { force: true });
        }

        return outputPath;
    };
}

module.exports = {
    startHighQualitySceneVideoCapture,
};
