import { render, screen, waitFor } from "@testing-library/react";

jest.mock("./SimilarPublicationItem", () => ({ item }) => <div>Item {item.content_id}</div>);
jest.mock("../loader/Loader", () => () => <div>Loading</div>);
jest.mock("../../service/ContentService", () => ({
    __esModule: true,
    default: {
        getSimilarContent: jest.fn(),
    },
}));

import ContentService from "../../service/ContentService";
import SimilarContentBlock from "./SimilarContentBlock";


beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
});

test("renders similar content items from API payload", async () => {
    ContentService.getSimilarContent.mockResolvedValue({
        data: {
            items: [
                { content: { content_id: "one", content_type: "post" } },
                { content: { content_id: "two", content_type: "video" } },
            ],
        },
    });

    render(<SimilarContentBlock contentId="content-1" />);

    await waitFor(() => expect(ContentService.getSimilarContent).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Item one")).not.toBeNull());
    expect(screen.getByText("Item two")).not.toBeNull();
});

test("renders empty state when API returns no items", async () => {
    ContentService.getSimilarContent.mockResolvedValue({
        data: {
            items: [],
        },
    });

    render(<SimilarContentBlock contentId="content-1" />);

    await waitFor(() => expect(screen.getByText("No similar publications yet.")).not.toBeNull());
});

test("hides block on fetch error by default", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    ContentService.getSimilarContent.mockRejectedValue(new Error("failed"));

    render(<SimilarContentBlock contentId="content-1" />);

    await waitFor(() => expect(ContentService.getSimilarContent).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Similar publications" })).toBeNull());
    consoleSpy.mockRestore();
});

test("shows error state when hideOnError is disabled", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    ContentService.getSimilarContent.mockRejectedValue(new Error("failed"));

    render(<SimilarContentBlock contentId="content-1" hideOnError={false} />);

    await waitFor(() => expect(screen.getByText("Failed to load similar publications.")).not.toBeNull());
    consoleSpy.mockRestore();
});

test("hides block in demo mode when requested", async () => {
    localStorage.setItem("demoMode", "true");
    ContentService.getSimilarContent.mockResolvedValue({
        data: {
            items: [{ content: { content_id: "one", content_type: "post" } }],
        },
    });

    render(<SimilarContentBlock contentId="content-1" hideInDemoMode />);

    await waitFor(() => expect(ContentService.getSimilarContent).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Similar publications" })).toBeNull();
});

test("hides empty block when hideWhenEmpty is enabled", async () => {
    ContentService.getSimilarContent.mockResolvedValue({
        data: {
            items: [],
        },
    });

    render(<SimilarContentBlock contentId="content-1" hideWhenEmpty />);

    await waitFor(() => expect(ContentService.getSimilarContent).toHaveBeenCalled());
    expect(screen.queryByText("No similar publications yet.")).toBeNull();
});
