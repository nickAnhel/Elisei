const COMMON_ACTIONS = {
    bold: {
        id: "bold",
        label: "Bold",
        icon: "bold",
        title: "Bold (Ctrl/Cmd+B)",
    },
    italic: {
        id: "italic",
        label: "Italic",
        icon: "italic",
        title: "Italic (Ctrl/Cmd+I)",
    },
    inline_code: {
        id: "inline_code",
        label: "Inline code",
        icon: "inline_code",
        title: "Inline code",
    },
    quote: {
        id: "quote",
        label: "Quote",
        icon: "quote",
        title: "Quote (Ctrl/Cmd+Shift+Q)",
    },
    link: {
        id: "link",
        label: "Link",
        icon: "link",
        title: "Insert link",
    },
    list: {
        id: "list",
        label: "List",
        icon: "list",
        title: "List (Ctrl/Cmd+Shift+L)",
    },
    code_block: {
        id: "code_block",
        label: "Code block",
        icon: "code_block",
        title: "Code block (Ctrl/Cmd+Alt+C)",
    },
    h1: {
        id: "h1",
        label: "Heading 1",
        icon: "h1",
        title: "Heading 1 (Ctrl/Cmd+Alt+1)",
    },
    h2: {
        id: "h2",
        label: "Heading 2",
        icon: "h2",
        title: "Heading 2 (Ctrl/Cmd+Alt+2)",
    },
    h3: {
        id: "h3",
        label: "Heading 3",
        icon: "h3",
        title: "Heading 3 (Ctrl/Cmd+Alt+3)",
    },
    h4: {
        id: "h4",
        label: "Heading 4",
        icon: "h4",
        title: "Heading 4 (Ctrl/Cmd+Alt+4)",
    },
    table: {
        id: "table",
        label: "Table",
        icon: "table",
        title: "Table (Ctrl/Cmd+Alt+T)",
    },
    spoiler: {
        id: "spoiler",
        label: "Spoiler",
        icon: "spoiler",
        title: "Spoiler (Ctrl/Cmd+Alt+S)",
    },
    mermaid: {
        id: "mermaid",
        label: "Mermaid diagram",
        icon: "mermaid",
        title: "Mermaid diagram (Ctrl/Cmd+Alt+M)",
    },
    platform_video: {
        id: "platform_video",
        label: "Insert video",
        icon: "platform_video",
        title: "Insert platform video (Ctrl/Cmd+Alt+Y)",
    },
    upload_image: {
        id: "upload_image",
        label: "Upload image",
        icon: "upload_image",
        title: "Upload image (Ctrl/Cmd+Shift+I)",
    },
    upload_video: {
        id: "upload_video",
        label: "Upload video",
        icon: "upload_video",
        title: "Upload video (Ctrl/Cmd+Alt+V)",
    },
};

const PRESET_KEYS = {
    comment: ["bold", "italic", "inline_code", "quote", "link"],
    post: ["bold", "italic", "inline_code", "quote", "list", "link", "code_block"],
    article: [
        "bold",
        "italic",
        "h2",
        "h3",
        "h4",
        "quote",
        "list",
        "code_block",
        "table",
        "spoiler",
        "platform_video",
        "upload_image",
        "upload_video",
        "link",
        "inline_code",
    ],
};

export function getMarkdownToolbarPreset(preset = "comment") {
    const keys = PRESET_KEYS[preset] || PRESET_KEYS.comment;
    return keys.map((key) => COMMON_ACTIONS[key]).filter(Boolean);
}
