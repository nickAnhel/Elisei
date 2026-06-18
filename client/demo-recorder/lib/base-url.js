const http = require("http");
const https = require("https");


function probeBaseUrl(rawUrl, timeout = 5000) {
    return new Promise((resolve) => {
        let parsedUrl;

        try {
            parsedUrl = new URL(rawUrl);
        } catch (error) {
            resolve({
                ok: false,
                code: "INVALID_URL",
                message: error.message,
            });
            return;
        }

        const transport = parsedUrl.protocol === "https:" ? https : http;
        const request = transport.request(
            {
                protocol: parsedUrl.protocol,
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname || "/",
                method: "GET",
                timeout,
            },
            (response) => {
                response.resume();
                resolve({
                    ok: true,
                    statusCode: response.statusCode,
                });
            },
        );

        request.on("timeout", () => {
            request.destroy(new Error("Request timed out"));
        });

        request.on("error", (error) => {
            resolve({
                ok: false,
                code: error.code || "REQUEST_ERROR",
                message: error.message,
            });
        });

        request.end();
    });
}

async function ensureDemoBaseUrlReachable(baseUrl) {
    const result = await probeBaseUrl(baseUrl);

    if (result.ok) {
        return;
    }

    const error = new Error(
        [
            `Demo base URL is not reachable: ${baseUrl}`,
            `Probe failure: ${result.code}${result.message ? ` (${result.message})` : ""}`,
            "Start the frontend at DEMO_BASE_URL before running the recorder.",
            "Typical local flow:",
            "  cd client && npm start",
            "Also ensure the backend/API stack is running if the login page depends on it.",
        ].join("\n"),
    );
    error.code = "DEMO_BASE_URL_UNREACHABLE";
    throw error;
}

module.exports = {
    ensureDemoBaseUrlReachable,
};
