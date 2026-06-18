import { fireEvent, render, screen } from "@testing-library/react";

const mockNavigate = jest.fn();
let mockLocationSearch = "";
let latestPostModalProps = null;

jest.mock("react-router-dom", () => ({
    useNavigate: () => mockNavigate,
    useSearchParams: () => {
        const React = require("react");
        const [params, setParams] = React.useState(() => new URLSearchParams(mockLocationSearch));

        const setSearchParams = (nextParams) => {
            if (nextParams instanceof URLSearchParams) {
                setParams(new URLSearchParams(nextParams));
                return;
            }
            setParams(new URLSearchParams(nextParams));
        };

        return [params, setSearchParams];
    },
}), { virtual: true });

jest.mock("../..", () => {
    const React = require("react");
    return {
        StoreContext: React.createContext({ store: {} }),
    };
}, { virtual: true });

jest.mock("../global-search-input/GlobalSearchInput", () => ({
    value,
    onChange,
    onSubmit,
}) => (
    <div>
        <input
            aria-label="feed-search-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" onClick={() => onSubmit(value)}>
            Submit feed search
        </button>
    </div>
));

jest.mock("../post-modal/PostModal", () => (props) => {
    latestPostModalProps = props;
    return null;
});

jest.mock("../../service/PostService", () => ({
    __esModule: true,
    default: {
        createPost: jest.fn(),
    },
}));

import FeedSidebar from "./FeedSidebar";
import { StoreContext } from "../..";


beforeEach(() => {
    jest.clearAllMocks();
    mockLocationSearch = "";
    latestPostModalProps = null;
});


test("feed sidebar sends query to /search and keeps only recommendations/subscriptions navigation labels", () => {
    const store = { isAuthenticated: false };
    render(
        <StoreContext.Provider value={{ store }}>
            <FeedSidebar />
        </StoreContext.Provider>
    );

    expect(screen.getByText("Recommendations")).not.toBeNull();
    expect(screen.queryByText("Global")).toBeNull();
    expect(screen.queryByText("Personal")).toBeNull();

    fireEvent.change(screen.getByLabelText("feed-search-input"), {
        target: { value: "neo4j tags" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit feed search" }));

    expect(mockNavigate).toHaveBeenCalledWith("/search?q=neo4j%20tags&type=all");
});

test("create post modal navigates to profile query details route after save", () => {
    const store = {
        isAuthenticated: true,
        user: { username: "owner" },
    };
    render(
        <StoreContext.Provider value={{ store }}>
            <FeedSidebar />
        </StoreContext.Provider>
    );

    expect(
        latestPostModalProps.navigateTo({
            user: { username: "alice" },
            post_id: "post-123",
        })
    ).toBe("/people/@alice?p=post-123");
});

test("create post modal falls back to authenticated username when response user is absent", () => {
    const store = {
        isAuthenticated: true,
        user: { username: "owner" },
    };
    render(
        <StoreContext.Provider value={{ store }}>
            <FeedSidebar />
        </StoreContext.Provider>
    );

    expect(
        latestPostModalProps.navigateTo({
            post_id: "post-123",
        })
    ).toBe("/people/@owner?p=post-123");
});
