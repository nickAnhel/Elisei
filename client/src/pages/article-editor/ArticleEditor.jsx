import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import "./ArticleEditor.css";

import { StoreContext } from "../..";
import ArticleService from "../../service/ArticleService";
import AssetService from "../../service/AssetService";

import Unauthorized from "../../components/unauthorized/Unauthorized";
import Loader from "../../components/loader/Loader";
import Modal from "../../components/modal/Modal";
import MediaViewer from "../../components/media-viewer";
import MarkdownToolbar from "../../components/markdown-toolbar";
import TagInput from "../../components/tag-input/TagInput";
import ArticleRenderer from "../../components/article-renderer/ArticleRenderer";
import AddIcon from "../../components/icons/AddIcon";
import { Button, Select } from "../../components/ui";
import { buildComposerAttachmentFromAsset, resolveAssetTypeForFile } from "../../utils/postAttachments";
import { MarkdownIcon, PreviewIcon, SplitViewIcon } from "../../components/icons/ArticleUiIcons";
import {
    buildArticleAssetLookup,
    buildMermaidBlock,
    buildMermaidPreviewUrl,
    collectReferencedArticleAssetIds,
    findMermaidBlockAtSelection,
    insertAtCursor,
    prefixSelectedLines,
    replaceMermaidBlockByIndex,
    replaceSelection,
    wrapSelection,
} from "../../utils/articleMarkdown";
import { normalizeTagList } from "../../utils/tags";


const DEFAULT_FORM = {
    title: "",
    bodyMarkdown: "",
    status: "draft",
    visibility: "private",
    tags: [],
};

const DEFAULT_MERMAID_CODE = "flowchart TD\n    Start[Idea] --> Draft[Draft]\n    Draft --> Publish[Published]";

function ArticleEditor() {
    const { store } = useContext(StoreContext);
    const navigate = useNavigate();
    const { articleId: routeArticleId } = useParams();

    const textareaRef = useRef(null);
    const coverInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const lastSavedSnapshotRef = useRef("");
    const persistArticleRef = useRef(null);
    const formRef = useRef(DEFAULT_FORM);
    const coverAssetRef = useRef(null);

    const [articleId, setArticleId] = useState(routeArticleId || null);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [coverAsset, setCoverAsset] = useState(null);
    const [editorAssets, setEditorAssets] = useState([]);
    const [isLoading, setIsLoading] = useState(Boolean(routeArticleId));
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saveState, setSaveState] = useState("Draft not saved yet");
    const [editorViewMode, setEditorViewMode] = useState("split");
    const [tagInputState, setTagInputState] = useState({
        value: "",
        normalizedValue: "",
        error: "",
    });
    const [assetError, setAssetError] = useState("");
    const [isMermaidModalActive, setIsMermaidModalActive] = useState(false);
    const [mermaidDraft, setMermaidDraft] = useState(DEFAULT_MERMAID_CODE);
    const [editingMermaidBlockIndex, setEditingMermaidBlockIndex] = useState(null);
    const [mediaViewerItems, setMediaViewerItems] = useState([]);
    const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
    const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);

    useEffect(() => {
        const nextArticleId = routeArticleId || null;
        setArticleId(nextArticleId);
        if (!nextArticleId) {
            setForm(DEFAULT_FORM);
            setCoverAsset(null);
            setEditorAssets([]);
            lastSavedSnapshotRef.current = "";
            setIsLoading(false);
            return;
        }

        const fetchArticle = async () => {
            setIsLoading(true);
            try {
                const res = await ArticleService.getArticleEditor(nextArticleId);
                const nextForm = {
                    title: res.data.title || "",
                    bodyMarkdown: res.data.body_markdown || "",
                    status: res.data.status || "draft",
                    visibility: res.data.visibility || "private",
                    tags: normalizeTagList(res.data.tags),
                };
                setForm(nextForm);
                setCoverAsset((prevCoverAsset) => mergeCoverAsset(prevCoverAsset, res.data.cover));
                setEditorAssets((prevAssets) => mergeEditorAssets({
                    previousAssets: prevAssets,
                    nextAssets: res.data.referenced_assets || [],
                    bodyMarkdown: res.data.body_markdown || "",
                }));
                lastSavedSnapshotRef.current = buildSnapshot(nextForm, res.data.cover || null);
                setSaveState("All changes saved");
            } catch (error) {
                console.log(error);
                setSaveError(error?.response?.data?.detail || "Failed to load article editor.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchArticle();
    }, [routeArticleId]);

    useEffect(() => {
        formRef.current = form;
    }, [form]);

    useEffect(() => {
        coverAssetRef.current = coverAsset;
    }, [coverAsset]);

    const snapshot = useMemo(
        () => buildSnapshot(form, coverAsset),
        [form, coverAsset]
    );

    const hasMeaningfulContent = Boolean(
        form.title.trim()
        || form.bodyMarkdown.trim()
        || coverAsset?.asset_id
    );

    useEffect(() => {
        if (isLoading || isSaving || form.status !== "draft") {
            return undefined;
        }

        if (!hasMeaningfulContent || snapshot === lastSavedSnapshotRef.current) {
            return undefined;
        }

        setSaveState("Saving draft...");
        const timerId = setTimeout(() => {
            persistArticleRef.current?.({ autosave: true });
        }, 2000);

        return () => clearTimeout(timerId);
    }, [snapshot, articleId, isLoading, isSaving, form.status, hasMeaningfulContent]);

    const previewArticle = useMemo(() => ({
        referenced_assets: editorAssets,
        cover: coverAsset,
    }), [editorAssets, coverAsset]);

    const applyTextareaEdit = (transformer) => {
        const textarea = textareaRef.current;
        const result = transformer(textarea);
        setForm((prevForm) => ({
            ...prevForm,
            bodyMarkdown: result.value,
        }));

        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd);
            }
        });
    };

    const insertMarkdown = (template, fallbackSelection = "") => {
        applyTextareaEdit((textarea) => replaceSelection(textarea, template, fallbackSelection));
    };

    const wrapMarkdownSelection = (before, after, fallbackSelection = "") => {
        applyTextareaEdit((textarea) => wrapSelection(textarea, before, after, fallbackSelection));
    };

    const prefixMarkdownLines = (prefix, fallbackLine = "") => {
        applyTextareaEdit((textarea) => prefixSelectedLines(textarea, prefix, fallbackLine));
    };

    const openMermaidEditor = (payload = null) => {
        const textarea = textareaRef.current;
        const existingBlock = payload || findMermaidBlockAtSelection(
            textarea?.value || formRef.current.bodyMarkdown || "",
            textarea?.selectionStart || 0,
            textarea?.selectionEnd || 0,
        );

        if (existingBlock) {
            setEditingMermaidBlockIndex(existingBlock.index);
            setMermaidDraft(existingBlock.code || DEFAULT_MERMAID_CODE);
        } else {
            setEditingMermaidBlockIndex(null);
            setMermaidDraft(DEFAULT_MERMAID_CODE);
        }

        setIsMermaidModalActive(true);
    };

    const saveMermaidDiagram = () => {
        const nextCode = mermaidDraft.trim();
        if (!nextCode) {
            setIsMermaidModalActive(false);
            return;
        }

        if (editingMermaidBlockIndex !== null) {
            setForm((prevForm) => ({
                ...prevForm,
                bodyMarkdown: replaceMermaidBlockByIndex(prevForm.bodyMarkdown, editingMermaidBlockIndex, nextCode),
            }));
        } else {
            applyTextareaEdit((textarea) => insertAtCursor(textarea, `${buildMermaidBlock(nextCode)}\n`));
        }

        setIsMermaidModalActive(false);
        setEditingMermaidBlockIndex(null);
    };

    const persistArticle = async ({ autosave = false, publish = false } = {}) => {
        if (!hasMeaningfulContent && autosave) {
            return null;
        }
        if (tagInputState.error) {
            if (!autosave) {
                setSaveError(tagInputState.error);
            }
            return null;
        }

        const payload = {
            title: form.title,
            body_markdown: form.bodyMarkdown,
            status: publish ? "published" : form.status,
            visibility: publish ? form.visibility : form.visibility,
            tags: form.tags,
            cover_asset_id: coverAsset?.asset_id || null,
        };
        const snapshotAtStart = buildSnapshot(
            {
                ...form,
                status: payload.status,
                visibility: payload.visibility,
            },
            coverAsset
        );

        setIsSaving(true);
        setSaveError("");
        setAssetError("");
        setSaveState(autosave ? "Saving draft..." : "Saving article...");

        try {
            const res = articleId
                ? await ArticleService.updateArticle(articleId, payload)
                : await ArticleService.createArticle(payload);
            const savedArticle = res.data;

            setArticleId(savedArticle.article_id);
            setEditorAssets((prevAssets) => mergeEditorAssets({
                previousAssets: prevAssets,
                nextAssets: savedArticle.referenced_assets || [],
                bodyMarkdown: formRef.current.bodyMarkdown,
            }));
            setCoverAsset((prevCoverAsset) => mergeCoverAsset(
                prevCoverAsset,
                savedArticle.cover,
                coverAssetRef.current?.asset_id || null,
            ));
            lastSavedSnapshotRef.current = snapshotAtStart;
            setSaveState(savedArticle.status === "published" ? "Published" : "Draft saved");

            if (!routeArticleId) {
                navigate(`/articles/${savedArticle.article_id}/edit`, { replace: true });
            }

            if (publish || payload.status === "published") {
                navigate(savedArticle.canonical_path);
            }

            return savedArticle;
        } catch (error) {
            const detail = error?.response?.data?.detail || "Failed to save article.";
            setSaveError(detail);
            setSaveState("Save failed");
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        persistArticleRef.current = persistArticle;
    });

    const uploadAssetFile = async (file, usageContext, attachmentType) => {
        const assetType = resolveAssetTypeForFile(file);
        const initRes = await AssetService.initUpload({
            filename: file.name,
            size_bytes: file.size,
            declared_mime_type: file.type || null,
            asset_type: assetType,
            usage_context: usageContext,
        });
        const uploadRes = await AssetService.uploadFile(
            initRes.data.upload_url,
            file,
            initRes.data.upload_headers,
        );
        if (!uploadRes.ok) {
            throw new Error(await uploadRes.text() || "Upload failed.");
        }

        const finalizeRes = await AssetService.finalizeUpload(initRes.data.asset.asset_id);
        return buildComposerAttachmentFromAsset(
            finalizeRes.data.asset,
            attachmentType,
            file.name,
        );
    };

    const handleCoverUpload = async (file) => {
        if (!file) {
            return;
        }
        setAssetError("");
        if (resolveAssetTypeForFile(file) !== "image") {
            setAssetError("Cover must be an image.");
            return;
        }

        try {
            const asset = await uploadAssetFile(file, "article_cover", "cover");
            setCoverAsset(asset);
        } catch (error) {
            setAssetError(error?.message || error?.response?.data?.detail || "Failed to upload cover.");
        }
    };

    const handleInlineAssetUpload = async (file, variant) => {
        if (!file) {
            return;
        }
        setAssetError("");
        const expectedType = variant === "image" ? "image" : "video";
        if (resolveAssetTypeForFile(file) !== expectedType) {
            setAssetError(`Selected file must be a ${expectedType}.`);
            return;
        }

        try {
            const attachmentType = variant === "image" ? "inline" : "video_source";
            const usageContext = variant === "image" ? "article_inline_image" : "article_video";
            const asset = await uploadAssetFile(file, usageContext, attachmentType);
            setEditorAssets((prevAssets) => ([
                ...prevAssets.filter((item) => item.asset_id !== asset.asset_id),
                asset,
            ]));
            const directive = variant === "image"
                ? `::image{asset-id="${asset.asset_id}" size="wide" caption=""}\n`
                : `::video{asset-id="${asset.asset_id}" size="wide" caption=""}\n`;
            applyTextareaEdit((textarea) => insertAtCursor(textarea, directive));
        } catch (error) {
            setAssetError(error?.message || error?.response?.data?.detail || "Failed to upload asset.");
        }
    };

    const handleEditorPaste = async (event) => {
        const files = Array.from(event.clipboardData?.files || []);
        const imageFile = files.find((file) => resolveAssetTypeForFile(file) === "image");
        if (!imageFile) {
            return;
        }

        event.preventDefault();
        await handleInlineAssetUpload(imageFile, "image");
    };

    const handleEditorKeyDown = (event) => {
        const isPrimaryModifier = event.metaKey || event.ctrlKey;
        if (!isPrimaryModifier) {
            return;
        }

        const key = event.key.toLowerCase();

        if (key === "b" && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            wrapMarkdownSelection("**", "**", "bold text");
            return;
        }

        if (key === "i" && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            wrapMarkdownSelection("*", "*", "italic text");
            return;
        }

        if (event.altKey && !event.shiftKey && key === "2") {
            event.preventDefault();
            prefixMarkdownLines("## ", "Section heading");
            return;
        }

        if (event.altKey && !event.shiftKey && key === "1") {
            event.preventDefault();
            prefixMarkdownLines("# ", "Main heading");
            return;
        }

        if (event.altKey && !event.shiftKey && key === "3") {
            event.preventDefault();
            prefixMarkdownLines("### ", "Subsection heading");
            return;
        }

        if (event.altKey && !event.shiftKey && key === "4") {
            event.preventDefault();
            prefixMarkdownLines("#### ", "Minor heading");
            return;
        }

        if (event.shiftKey && key === "q") {
            event.preventDefault();
            prefixMarkdownLines("> ", "Quoted text");
            return;
        }

        if (event.shiftKey && key === "l") {
            event.preventDefault();
            prefixMarkdownLines("- ", "List item");
            return;
        }

        if (event.altKey && !event.shiftKey && key === "c") {
            event.preventDefault();
            wrapMarkdownSelection("```js\n", "\n```", "console.log('Hello')");
            return;
        }

        if (event.altKey && !event.shiftKey && key === "s") {
            event.preventDefault();
            wrapMarkdownSelection(":::spoiler[Context]\n", "\n:::", "Hidden details");
            return;
        }

        if (event.altKey && !event.shiftKey && key === "t") {
            event.preventDefault();
            insertMarkdown("| Column | Value |\n| --- | --- |\n| $SELECTION$ |  |\n", "Item");
            return;
        }

        if (event.altKey && !event.shiftKey && key === "m") {
            event.preventDefault();
            openMermaidEditor();
            return;
        }

        if (event.altKey && !event.shiftKey && key === "y") {
            event.preventDefault();
            insertMarkdown('::youtube{id="dQw4w9WgXcQ" title="Video"}\n');
            return;
        }

        if (event.shiftKey && key === "i") {
            event.preventDefault();
            imageInputRef.current?.click();
            return;
        }

        if (event.altKey && !event.shiftKey && key === "v") {
            event.preventDefault();
            videoInputRef.current?.click();
        }
    };

    const handleToolbarApply = (action) => {
        switch (action.id) {
        case "bold":
            wrapMarkdownSelection("**", "**", "bold text");
            break;
        case "italic":
            wrapMarkdownSelection("*", "*", "italic text");
            break;
        case "inline_code":
            wrapMarkdownSelection("`", "`", "code");
            break;
        case "quote":
            prefixMarkdownLines("> ", "Quoted text");
            break;
        case "list":
            prefixMarkdownLines("- ", "List item");
            break;
        case "code_block":
            wrapMarkdownSelection("```js\n", "\n```", "console.log('Hello')");
            break;
        case "h1":
            prefixMarkdownLines("# ", "Main heading");
            break;
        case "h2":
            prefixMarkdownLines("## ", "Section heading");
            break;
        case "h3":
            prefixMarkdownLines("### ", "Subsection heading");
            break;
        case "h4":
            prefixMarkdownLines("#### ", "Minor heading");
            break;
        case "table":
            insertMarkdown("| Column | Value |\n| --- | --- |\n| $SELECTION$ |  |\n", "Item");
            break;
        case "spoiler":
            wrapMarkdownSelection(":::spoiler[Context]\n", "\n:::", "Hidden details");
            break;
        case "youtube":
            insertMarkdown('::youtube{id="dQw4w9WgXcQ" title="Video"}\n');
            break;
        case "link":
            insertMarkdown("[$SELECTION$](https://example.com)", "link text");
            break;
        case "upload_image":
            imageInputRef.current?.click();
            break;
        case "upload_video":
            videoInputRef.current?.click();
            break;
        default:
            break;
        }
    };

    const handleArticleMediaOpen = ({ item, items = [] }) => {
        if (!item) {
            return;
        }

        const nextItems = items.length > 0 ? items : [item];
        const nextIndex = Math.max(nextItems.findIndex((entry) => entry.id === item.id), 0);

        setMediaViewerItems(nextItems);
        setMediaViewerIndex(nextIndex);
        setIsMediaViewerOpen(true);
    };

    if (!store.isAuthenticated) {
        return (
            <div id="article-editor-page">
                <Unauthorized />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div id="article-editor-page" className="article-editor-state">
                <Loader />
            </div>
        );
    }

    return (
        <div id="article-editor-page">
            <div className="article-editor-shell">
                <section className="article-editor-panel">
                    <div className="article-editor-header">
                        <div>
                            <h1>{articleId ? "Edit article" : "New article"}</h1>
                        </div>
                        <div className="article-editor-status">
                            <span>{saveState}</span>
                            {isSaving && <Loader />}
                        </div>
                    </div>

                    <div className="article-editor-meta-grid">
                        <label>
                            <span>Title</span>
                            <input
                                type="text"
                                value={form.title}
                                maxLength={300}
                                onChange={(event) => setForm((prevForm) => ({
                                    ...prevForm,
                                    title: event.target.value,
                                }))}
                                placeholder="Article title"
                            />
                        </label>

                        <Select
                            label="Status"
                            value={form.status}
                            onChange={(event) => setForm((prevForm) => ({
                                ...prevForm,
                                status: event.target.value,
                            }))}
                        >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                        </Select>

                        <Select
                            label="Visibility"
                            value={form.visibility}
                            onChange={(event) => setForm((prevForm) => ({
                                ...prevForm,
                                visibility: event.target.value,
                            }))}
                        >
                                <option value="private">Private</option>
                                <option value="public">Public</option>
                        </Select>
                    </div>

                    <div className="article-cover-panel">
                        <div className="article-section-label">Cover</div>
                        {
                            coverAsset?.preview_url
                                ? (
                                    <div className="article-cover-preview">
                                        <img src={coverAsset.preview_url} alt={form.title || "Article cover"} />
                                        <div className="article-cover-actions">
                                            <button type="button" onClick={() => coverInputRef.current?.click()}>
                                                Replace cover
                                            </button>
                                            <button type="button" onClick={() => setCoverAsset(null)}>
                                                Remove cover
                                            </button>
                                        </div>
                                    </div>
                                )
                                : (
                                    <button type="button" className="article-cover-trigger" onClick={() => coverInputRef.current?.click()}>
                                        <AddIcon />
                                        <span>Upload cover</span>
                                    </button>
                                )
                        }
                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(event) => handleCoverUpload(event.target.files?.[0])}
                        />
                    </div>

                    <TagInput
                        tags={form.tags}
                        onChange={(tags) => setForm((prevForm) => ({ ...prevForm, tags }))}
                        onInputStateChange={setTagInputState}
                    />

                    <div className="article-editor-view-toggle" role="tablist" aria-label="Editor view mode">
                        <button
                            type="button"
                            className={editorViewMode === "source" ? "active" : ""}
                            onClick={() => setEditorViewMode("source")}
                            title="Markdown mode"
                        >
                            <MarkdownIcon />
                            <span>Markdown</span>
                        </button>
                        <button
                            type="button"
                            className={editorViewMode === "split" ? "active" : ""}
                            onClick={() => setEditorViewMode("split")}
                            title="Split mode"
                        >
                            <SplitViewIcon />
                            <span>Split</span>
                        </button>
                        <button
                            type="button"
                            className={editorViewMode === "preview" ? "active" : ""}
                            onClick={() => setEditorViewMode("preview")}
                            title="Rendered preview"
                        >
                            <PreviewIcon />
                            <span>Preview</span>
                        </button>
                    </div>

                    <MarkdownToolbar
                        id="article-markdown-toolbar"
                        className="article-editor-toolbar"
                        preset="article"
                        textareaRef={textareaRef}
                        disabled={isSaving}
                        onApply={handleToolbarApply}
                    />

                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => handleInlineAssetUpload(event.target.files?.[0], "image")}
                    />
                    <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        hidden
                        onChange={(event) => handleInlineAssetUpload(event.target.files?.[0], "video")}
                    />

                    <div className="article-editor-workspace">
                        <div className={`article-editor-markdown ${editorViewMode === "preview" ? "hidden" : ""}`}>
                            <div className="article-section-label">Body markdown</div>
                            <textarea
                                ref={textareaRef}
                                value={form.bodyMarkdown}
                                onChange={(event) => setForm((prevForm) => ({
                                    ...prevForm,
                                    bodyMarkdown: event.target.value,
                                }))}
                                onPaste={handleEditorPaste}
                                onKeyDown={handleEditorKeyDown}
                                placeholder="Write your article in markdown..."
                            />
                            <p className="article-editor-hint">
                                View modes: Markdown, Split, Rendered preview. Shortcuts work in the markdown pane.
                            </p>
                        </div>

                        <div className={`article-editor-preview ${editorViewMode === "source" ? "hidden" : ""}`}>
                            <div className="article-section-label">{editorViewMode === "preview" ? "Rendered view" : "Live preview"}</div>
                            <div className="article-editor-preview-card">
                                <ArticleRenderer
                                    bodyMarkdown={form.bodyMarkdown}
                                    article={previewArticle}
                                    extraAssets={Object.values(buildArticleAssetLookup(previewArticle))}
                                    renderMode="editor"
                                    onEditMermaid={openMermaidEditor}
                                    onMediaOpen={handleArticleMediaOpen}
                                />
                            </div>
                        </div>
                    </div>

                    {(saveError || assetError) && <div className="article-editor-error">{saveError || assetError}</div>}

                    <div className="article-editor-actions">
                        <Button type="button" variant="secondary" onClick={() => persistArticle()}>
                            Save now
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => persistArticle({ publish: form.status === "published" })}
                        >
                            {form.status === "published" ? "Publish / Update" : "Save draft"}
                        </Button>
                    </div>
                </section>
            </div>

            <Modal active={isMermaidModalActive} setActive={setIsMermaidModalActive}>
                <div className="article-mermaid-modal">
                    <h2>Mermaid diagram</h2>
                    <p>Edit the diagram source and preview the rendered result before inserting it into the article.</p>
                    <textarea
                        value={mermaidDraft}
                        onChange={(event) => setMermaidDraft(event.target.value)}
                        rows={10}
                    />
                    <div className="article-mermaid-modal-preview">
                        {
                            buildMermaidPreviewUrl(mermaidDraft)
                                ? <img src={buildMermaidPreviewUrl(mermaidDraft)} alt="Mermaid preview" />
                                : null
                        }
                        <pre>{mermaidDraft}</pre>
                    </div>
                    <div className="article-mermaid-modal-actions">
                        <Button type="button" variant="secondary" onClick={() => setIsMermaidModalActive(false)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="primary" onClick={saveMermaidDiagram}>
                            {editingMermaidBlockIndex !== null ? "Update diagram" : "Insert diagram"}
                        </Button>
                    </div>
                </div>
            </Modal>

            <MediaViewer
                open={isMediaViewerOpen}
                items={mediaViewerItems}
                activeIndex={mediaViewerIndex}
                onClose={() => setIsMediaViewerOpen(false)}
                onIndexChange={setMediaViewerIndex}
                ariaLabel="Article editor media preview"
                videoSkin="article"
            />
        </div>
    );
}

function buildSnapshot(form, coverAsset) {
    return JSON.stringify({
        title: form.title,
        bodyMarkdown: form.bodyMarkdown,
        status: form.status,
        visibility: form.visibility,
        tags: form.tags,
        coverAssetId: coverAsset?.asset_id || null,
    });
}

function mergeCoverAsset(previousCover, nextCover, expectedAssetId = null) {
    if (nextCover?.asset_id) {
        return {
            ...(previousCover || {}),
            ...nextCover,
        };
    }

    if (
        previousCover?.asset_id
        && expectedAssetId
        && previousCover.asset_id === expectedAssetId
    ) {
        return previousCover;
    }

    return nextCover || null;
}

function mergeEditorAssets({
    previousAssets,
    nextAssets,
    bodyMarkdown,
}) {
    const mergedAssets = new Map();
    const referencedAssetIds = collectReferencedArticleAssetIds(bodyMarkdown);

    (previousAssets || []).forEach((asset) => {
        if (asset?.asset_id) {
            mergedAssets.set(asset.asset_id, asset);
        }
    });

    (nextAssets || []).forEach((asset) => {
        if (asset?.asset_id) {
            mergedAssets.set(asset.asset_id, {
                ...(mergedAssets.get(asset.asset_id) || {}),
                ...asset,
            });
        }
    });

    return Array.from(mergedAssets.values()).filter((asset) => referencedAssetIds.has(asset.asset_id));
}

export default ArticleEditor;
