import { render, screen } from "@testing-library/react";

const mockContentListSpy = jest.fn();

jest.mock("../..", () => ({
    StoreContext: require("react").createContext({
        store: {
            isAuthenticated: true,
            isRefreshPosts: 0,
        },
    }),
}));
jest.mock("../../components/content-list/ContentList", () => (props) => {
    mockContentListSpy(props);
    return <div />;
});
jest.mock("../../components/video-card/VideoCard", () => () => <div />);
jest.mock("../../service/ContentService", () => ({
    __esModule: true,
    default: {
        getVideoRecommendations: jest.fn(),
        getVideoSubscriptions: jest.fn(),
    },
}));
jest.mock("../../service/VideoService", () => ({
    __esModule: true,
    default: {
        getVideos: jest.fn(),
    },
}));
jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => jest.fn(),
    useSearchParams: () => [
        new URLSearchParams("tab=recommendations"),
        jest.fn(),
    ],
}), { virtual: true });

import Videos from "./Videos";


test("Videos sidebar does not render Moments tab", () => {
    render(<Videos />);

    expect(screen.getAllByText("Recommendations").length).toBeGreaterThan(0);
    expect(screen.queryByText("Moments")).toBeNull();
    expect(screen.queryByText("History")).toBeNull();
    const props = mockContentListSpy.mock.calls.at(-1)[0];
    expect(props.pageSize).toBe(10);
});
