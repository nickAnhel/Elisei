const { spawnSync } = require("child_process");


function runFfmpeg(args, options = {}) {
    const result = spawnSync("ffmpeg", args, {
        stdio: "inherit",
        ...options,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`ffmpeg exited with status ${result.status}`);
    }
}

function ensureFfmpegInstalled(commandName = "npm run demo:build-video") {
    const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    if (result.error || result.status !== 0) {
        const error = new Error(
            [
                "FFmpeg is required for the demo recorder but was not found in PATH.",
                `Install ffmpeg and rerun \`${commandName}\`.`,
            ].join("\n"),
        );
        error.code = "FFMPEG_MISSING";
        throw error;
    }
}

function getAvailableEncoders() {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], {
        encoding: "utf8",
    });
    if (result.error || result.status !== 0) {
        throw new Error("Failed to inspect ffmpeg encoders.");
    }

    return new Set(
        result.stdout
            .split(/\r?\n/)
            .map((line) => line.trim().split(/\s+/)[1])
            .filter(Boolean),
    );
}

function selectVideoEncoder(encoders) {
    if (encoders.has("libx264")) {
        return {
            name: "libx264",
            args: [
                "-c:v",
                "libx264",
                "-preset",
                "slow",
                "-crf",
                "12",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
            ],
        };
    }

    if (encoders.has("libopenh264")) {
        return {
            name: "libopenh264",
            args: [
                "-c:v",
                "libopenh264",
                "-b:v",
                "24M",
                "-maxrate",
                "28M",
                "-bufsize",
                "48M",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
            ],
        };
    }

    if (encoders.has("mpeg4")) {
        return {
            name: "mpeg4",
            args: [
                "-c:v",
                "mpeg4",
                "-q:v",
                "1",
                "-b:v",
                "24M",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
            ],
        };
    }

    if (encoders.has("libxvid")) {
        return {
            name: "libxvid",
            args: [
                "-c:v",
                "libxvid",
                "-q:v",
                "1",
                "-b:v",
                "24M",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
            ],
        };
    }

    throw new Error(
        "No compatible MP4 video encoder was found in ffmpeg. "
        + "Expected one of: libx264, libopenh264, mpeg4, libxvid.",
    );
}

function selectAudioEncoder(encoders) {
    if (encoders.has("aac")) {
        return {
            name: "aac",
            args: [
                "-c:a",
                "aac",
                "-b:a",
                "256k",
            ],
        };
    }

    if (encoders.has("libfdk_aac")) {
        return {
            name: "libfdk_aac",
            args: [
                "-c:a",
                "libfdk_aac",
                "-b:a",
                "256k",
            ],
        };
    }

    return {
        name: "none",
        args: ["-an"],
    };
}

module.exports = {
    ensureFfmpegInstalled,
    getAvailableEncoders,
    runFfmpeg,
    selectAudioEncoder,
    selectVideoEncoder,
};
