import {
    buildMermaidBlock,
    insertAtCursor,
    prefixSelectedLines,
    replaceSelection,
    wrapSelection,
} from "./articleMarkdown";


export function applyMarkdownAction(textarea, actionId) {
    switch (actionId) {
    case "bold":
        return wrapSelection(textarea, "**", "**", "bold text");
    case "italic":
        return wrapSelection(textarea, "*", "*", "italic text");
    case "inline_code":
        return wrapSelection(textarea, "`", "`", "code");
    case "quote":
        return prefixSelectedLines(textarea, "> ", "Quoted text");
    case "list":
        return prefixSelectedLines(textarea, "- ", "List item");
    case "link":
        return replaceSelection(textarea, "[$SELECTION$](https://example.com)", "link text");
    case "code_block":
        return wrapSelection(textarea, "```js\n", "\n```", "console.log('Hello')");
    case "h1":
        return prefixSelectedLines(textarea, "# ", "Main heading");
    case "h2":
        return prefixSelectedLines(textarea, "## ", "Section heading");
    case "h3":
        return prefixSelectedLines(textarea, "### ", "Subsection heading");
    case "h4":
        return prefixSelectedLines(textarea, "#### ", "Minor heading");
    case "table":
        return replaceSelection(textarea, "| Column | Value |\n| --- | --- |\n| $SELECTION$ |  |\n", "Item");
    case "spoiler":
        return wrapSelection(textarea, ":::spoiler[Context]\n", "\n:::", "Hidden details");
    case "platform_video":
        return replaceSelection(textarea, "::platform_video{video-id=\"\" size=\"wide\" caption=\"\"}\n", "");
    case "mermaid":
        return insertAtCursor(textarea, `${buildMermaidBlock("flowchart TD\n    Start[Idea] --> Draft[Draft]\n    Draft --> Publish[Published]")}\n`);
    default:
        return null;
    }
}

export function applyActionToValue({
    textareaRef,
    value,
    setValue,
    actionId,
}) {
    if (!setValue) {
        return false;
    }

    const textarea = textareaRef?.current;
    const virtualTextarea = textarea || {
        value: value || "",
        selectionStart: (value || "").length,
        selectionEnd: (value || "").length,
    };

    const result = applyMarkdownAction(virtualTextarea, actionId);
    if (!result) {
        return false;
    }

    setValue(result.value);

    requestAnimationFrame(() => {
        const target = textareaRef?.current;
        if (!target) {
            return;
        }

        target.focus();
        target.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd);
    });

    return true;
}
