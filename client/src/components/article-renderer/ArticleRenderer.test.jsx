import { render, screen } from "@testing-library/react";

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("react-markdown", () => ({ children }) => <div>{children}</div>);
jest.mock("remark-gfm", () => ({}));
jest.mock("react-syntax-highlighter", () => ({
    Prism: ({ children }) => <pre>{children}</pre>,
}));
jest.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
    oneDark: {},
}));
jest.mock("../video-player", () => ({ title }) => <div>{`Mock video player: ${title}`}</div>);

import ArticleRenderer from "./ArticleRenderer";


const article = {
    embedded_videos: [
        {
            video_id: "video-1",
            content_id: "video-1",
            canonical_path: "/videos/video-1",
            title: "Platform walkthrough",
            excerpt: "How the feature works",
            duration_seconds: 83,
            orientation: "landscape",
            processing_status: "ready",
            status: "published",
            visibility: "public",
            created_at: "2026-06-10T00:00:00Z",
            published_at: "2026-06-10T00:00:00Z",
            user: {
                username: "author",
                display_name: "Author",
            },
            cover: {
                preview_url: "https://cdn.example/video-cover.webp",
            },
            playback_sources: [
                {
                    id: "360p",
                    src: "https://cdn.example/video-1-360.mp4",
                    mimeType: "video/mp4",
                },
            ],
            chapters: [],
        },
    ],
};

test("renders embedded platform video with inline playback and a page link", () => {
    render(
        <ArticleRenderer
            bodyMarkdown='::platform_video{video-id="video-1" size="wide" caption=""}'
            article={article}
        />
    );

    expect(screen.getByText("Mock video player: Platform walkthrough")).not.toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/videos/video-1");
    expect(screen.getByText("Platform walkthrough")).not.toBeNull();
    expect(screen.getByText("1:23")).not.toBeNull();
});

test("shows unavailable placeholder when embedded platform video is missing", () => {
    render(
        <ArticleRenderer
            bodyMarkdown='::platform_video{video-id="missing-video" size="wide" caption=""}'
            article={{ embedded_videos: [] }}
        />
    );

    expect(screen.getByText("Embedded video is unavailable.")).not.toBeNull();
});
