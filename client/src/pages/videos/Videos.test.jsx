import { fireEvent, render, screen, waitFor } from "@testing-library/react";

let mockLocationSearch = "";
const mockContentListSpy = jest.fn();

jest.mock("react-router-dom", () => {
    const React = require("react");

    return {
        useNavigate: () => jest.fn(),
        useSearchParams: () => {
            const [params, setParams] = React.useState(() => new URLSearchParams(mockLocationSearch));

            const setSearchParams = (nextParams) => {
                if (nextParams instanceof URLSearchParams) {
                    setParams(new URLSearchParams(nextParams));
                    return;
                }
                if (typeof nextParams === "string") {
                    setParams(new URLSearchParams(nextParams));
                    return;
                }
                setParams(new URLSearchParams(nextParams));
            };

            return [params, setSearchParams];
        },
    };
}, { virtual: true });

jest.mock("../..", () => {
    const React = require("react");
    return {
        StoreContext: React.createContext({ store: {} }),
    };
}, { virtual: true });

jest.mock("../../components/global-search-input/GlobalSearchInput", () => () => <div />);
jest.mock("../../components/video-card/VideoCard", () => () => <div />);
jest.mock("../../components/content-list/ContentList", () => (props) => {
    mockContentListSpy(props);
    return <div data-testid="videos-content-list" />;
});

jest.mock("../../service/ContentService", () => ({
    __esModule: true,
    default: {
        getVideoRecommendations: jest.fn(),
        getVideoSubscriptions: jest.fn(),
    },
}));

import { StoreContext } from "../..";
import ContentService from "../../service/ContentService";
import Videos from "./Videos";


function renderVideos({ initialSearch = "", isAuthenticated = false } = {}) {
    mockLocationSearch = initialSearch;
    const store = {
        isAuthenticated,
        isRefreshPosts: false,
    };
    return render(
        <StoreContext.Provider value={{ store }}>
            <Videos />
        </StoreContext.Provider>
    );
}


beforeEach(() => {
    jest.clearAllMocks();
});


test("videos default to recommendations section with relevance sort", () => {
    renderVideos({ isAuthenticated: true });

    expect(screen.getByRole("heading", { name: "Videos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New video" })).toBeTruthy();

    const props = mockContentListSpy.mock.calls.at(-1)[0];
    expect(props.fetchItems).toBe(ContentService.getVideoRecommendations);
    expect(props.filters).toEqual({
        sort: "relevance",
    });
    expect(props.pageSize).toBe(10);
});


test("videos subscriptions section uses subscriptions feed for authenticated users", async () => {
    renderVideos({ isAuthenticated: true });

    fireEvent.click(screen.getByRole("tab", { name: "Subscriptions" }));

    await waitFor(() => {
        const props = mockContentListSpy.mock.calls.at(-1)[0];
        expect(props.fetchItems).toBe(ContentService.getVideoSubscriptions);
        expect(props.filters).toEqual({
            order: "published_at",
            desc: true,
        });
        expect(props.pageSize).toBe(5);
    });
});


test("videos subscriptions support oldest sort", () => {
    renderVideos({ initialSearch: "tab=subscriptions&sort=oldest", isAuthenticated: true });

    const props = mockContentListSpy.mock.calls.at(-1)[0];
    expect(props.fetchItems).toBe(ContentService.getVideoSubscriptions);
    expect(props.filters).toEqual({
        order: "published_at",
        desc: false,
    });
});
