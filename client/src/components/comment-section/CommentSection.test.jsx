import { fireEvent, render, screen, waitFor } from "@testing-library/react";

let mockStore = {
    isAuthenticated: true,
    user: {
        user_id: "user-1",
        username: "owner",
        avatar: {
            small_url: "https://cdn.example/avatar-small.webp",
        },
    },
};

jest.mock("../..", () => ({
    StoreContext: require("react").createContext({
        get store() {
            return mockStore;
        },
    }),
}));

jest.mock("react-router-dom", () => ({
    MemoryRouter: ({ children }) => <div>{children}</div>,
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}), { virtual: true });

jest.mock("../comment-composer/CommentComposer", () => ({ onSubmit }) => (
    <button type="button" onClick={() => onSubmit("Fresh comment")}>
        Submit comment
    </button>
));

jest.mock("../comment-list/CommentList", () => ({ comments }) => (
    comments[0]
        ? (
            <img
                alt={`${comments[0].author.username} avatar`}
                src={comments[0].author?.avatar?.small_url || "/assets/profile.svg"}
            />
        )
        : null
));

jest.mock("../../service/CommentService", () => ({
    __esModule: true,
    default: {
        getContentComments: jest.fn(),
        createContentComment: jest.fn(),
        getReplies: jest.fn(),
        createReply: jest.fn(),
        updateComment: jest.fn(),
        deleteComment: jest.fn(),
        likeComment: jest.fn(),
        unlikeComment: jest.fn(),
        dislikeComment: jest.fn(),
        undislikeComment: jest.fn(),
    },
}));

import { StoreContext } from "../..";
import CommentService from "../../service/CommentService";
import CommentSection from "./CommentSection";
import { MemoryRouter } from "react-router-dom";


beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {
        isAuthenticated: true,
        user: {
            user_id: "user-1",
            username: "owner",
            avatar: {
                small_url: "https://cdn.example/avatar-small.webp",
            },
        },
    };

    CommentService.getContentComments.mockResolvedValue({
        data: {
            items: [],
            has_more: false,
        },
    });
});

test("hydrates the current user avatar for a newly created comment", async () => {
    CommentService.createContentComment.mockResolvedValue({
        data: {
            comment_id: "comment-1",
            body_text: "Fresh comment",
            depth: 0,
            replies_count: 0,
            created_at: "2026-06-18T10:00:00Z",
            updated_at: "2026-06-18T10:00:00Z",
            is_owner: true,
            is_deleted: false,
            likes_count: 0,
            dislikes_count: 0,
            my_reaction: null,
            author: {
                user_id: "user-1",
                username: "owner",
                avatar: null,
            },
        },
    });

    render(
        <StoreContext.Provider value={{ store: mockStore }}>
            <MemoryRouter>
                <CommentSection contentId="post-1" isEnabled={true} />
            </MemoryRouter>
        </StoreContext.Provider>
    );

    await waitFor(() => {
        expect(CommentService.getContentComments).toHaveBeenCalledWith("post-1", {
            offset: 0,
            limit: 20,
        });
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit comment" }));

    await waitFor(() => {
        expect(screen.getByAltText("owner avatar").getAttribute("src")).toBe(
            "https://cdn.example/avatar-small.webp"
        );
    });
});
