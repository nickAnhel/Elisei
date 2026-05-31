import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import "./MarkdownRenderer.css";

import { MARKDOWN_RENDERER_PRESETS } from "./markdownRendererPresets";


function normalizeLinkHref(href = "") {
    const trimmed = href.trim();
    if (!trimmed) {
        return "#";
    }

    return trimmed;
}

function isExternalHref(href = "") {
    return /^(https?:)?\/\//i.test(href);
}

function MarkdownRenderer({
    preset = "comment",
    value = "",
    className = "",
}) {
    const config = MARKDOWN_RENDERER_PRESETS[preset] || MARKDOWN_RENDERER_PRESETS.comment;

    return (
        <div className={`markdown-renderer markdown-renderer-${preset} ${className}`.trim()}>
            <ReactMarkdown
                remarkPlugins={config.allowGfm ? [remarkGfm] : []}
                allowedElements={config.allowedElements}
                unwrapDisallowed={true}
                components={{
                    a({ href, children, ...props }) {
                        const normalizedHref = normalizeLinkHref(href);
                        const external = isExternalHref(normalizedHref);

                        return (
                            <a
                                href={normalizedHref}
                                target={external ? "_blank" : undefined}
                                rel={external ? "noreferrer" : undefined}
                                {...props}
                            >
                                {children}
                            </a>
                        );
                    },
                    code({ inline, className: codeClassName, children, ...props }) {
                        const match = /language-(\w+)/.exec(codeClassName || "");
                        return !inline && match ? (
                            <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ margin: 0, borderRadius: "0.75rem" }}
                                {...props}
                            >
                                {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                        ) : (
                            <code className={codeClassName} {...props}>
                                {children}
                            </code>
                        );
                    },
                }}
            >
                {value || ""}
            </ReactMarkdown>
        </div>
    );
}

export default MarkdownRenderer;
