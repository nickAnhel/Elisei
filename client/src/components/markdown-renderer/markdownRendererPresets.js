export const MARKDOWN_RENDERER_PRESETS = {
    comment: {
        allowGfm: false,
        allowedElements: ["p", "strong", "em", "code", "blockquote", "a", "br"],
    },
    post: {
        allowGfm: true,
        allowedElements: ["p", "strong", "em", "code", "pre", "blockquote", "a", "ul", "ol", "li", "br"],
    },
};
