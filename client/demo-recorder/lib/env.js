const fs = require("fs");

const { resolveDemoPath } = require("./paths");


function parseEnvFile(rawValue) {
    const env = {};

    rawValue.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            return;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) {
            return;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if (
            (value.startsWith("\"") && value.endsWith("\""))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        env[key] = value;
    });

    return env;
}

function loadDemoEnv({ requireAuth = false } = {}) {
    const envFilePath = resolveDemoPath(".env.demo-recorder");
    const fileEnv = fs.existsSync(envFilePath)
        ? parseEnvFile(fs.readFileSync(envFilePath, "utf8"))
        : {};
    const env = {
        DEMO_BASE_URL: "http://localhost:5173",
        DEMO_MODE: "true",
        DEMO_ACTION_DELAY_MS: "180",
        ...fileEnv,
        ...process.env,
    };

    if (requireAuth) {
        const missingKeys = ["DEMO_USER_LOGIN", "DEMO_USER_PASSWORD"].filter((key) => !env[key]);
        if (missingKeys.length > 0) {
            throw new Error(
                `Missing required demo recorder env values: ${missingKeys.join(", ")}. `
                + `Create client/demo-recorder/.env.demo-recorder from the example file.`,
            );
        }
    }

    return env;
}

module.exports = {
    loadDemoEnv,
};
