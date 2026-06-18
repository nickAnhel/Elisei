const path = require("path");


const demoRoot = path.resolve(__dirname, "..");

function resolveDemoPath(...segments) {
    return path.join(demoRoot, ...segments);
}

module.exports = {
    demoRoot,
    resolveDemoPath,
};
