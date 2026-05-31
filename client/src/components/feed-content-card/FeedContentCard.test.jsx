import { render, screen } from "@testing-library/react";

jest.mock("../video-card/VideoCard", () => {
    const React = require("react");
    return React.forwardRef(({ video, showExcerpt }, ref) => (
        <div ref={ref}>Video card: {video.title} | excerpt: {String(showExcerpt)}</div>
    ));
});
jest.mock("../article-card/ArticleCard", () => {
    const React = require("react");
    return React.forwardRef(({ showExcerpt }, ref) => <div ref={ref}>Article card | excerpt: {String(showExcerpt)}</div>);
});
jest.mock("../moment-card/MomentCard", () => {
    const React = require("react");
    return React.forwardRef(({ moment }, ref) => (
        <div ref={ref}>Moment card: {moment.caption}</div>
    ));
});
jest.mock("../post-list-item/PostListItem", () => {
    const React = require("react");
    return React.forwardRef(() => <div>Post card</div>);
});

test("dispatches moment content to MomentCard", () => {
    render(
        <FeedContentCard
            item={{
                content_id: "moment-1",
                content_type: "moment",
                caption: "Feed moment",
            }}
        />
    );

    expect(screen.getByText("Moment card: Feed moment")).not.toBeNull();
});

import FeedContentCard from "./FeedContentCard";


test("dispatches video content to VideoCard", () => {
    render(
        <FeedContentCard
            item={{
                content_id: "video-1",
                content_type: "video",
                title: "Feed video",
            }}
        />
    );

    expect(screen.getByText("Video card: Feed video | excerpt: false")).not.toBeNull();
});

test("dispatches article content to ArticleCard without excerpt in feed", () => {
    render(
        <FeedContentCard
            item={{
                content_id: "article-1",
                content_type: "article",
                title: "Feed article",
            }}
        />
    );

    expect(screen.getByText("Article card | excerpt: false")).not.toBeNull();
});
