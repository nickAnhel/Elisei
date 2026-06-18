const fs = require("fs");

const { resolveDemoPath } = require("./paths");


function loadDemoContent() {
    const contentPath = resolveDemoPath("materials", "demo-content.yml");
    return JSON.parse(fs.readFileSync(contentPath, "utf8"));
}

function loadArticleTemplate() {
    return fs.readFileSync(resolveDemoPath("materials", "article-body.md"), "utf8");
}

module.exports = {
    loadDemoContent,
    loadArticleTemplate,
};
