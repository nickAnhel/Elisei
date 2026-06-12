import { render, screen } from "@testing-library/react";

import Message from "./Message";

jest.mock("react-router-dom", () => ({
    Link: ({ children, className, to }) => (
        <a className={className} href={to}>{children}</a>
    ),
}), { virtual: true });

jest.mock("../video-player", () => () => null, { virtual: true });

jest.mock("../..", () => ({
    StoreContext: require("react").createContext({
        store: { user: { user_id: "user-1", username: "alice" } },
    }),
}));


test("renders unavailable shared content fallback", () => {
    render(
        <Message
            messageId="message-1"
            username="Bob"
            profileUsername="bob"
            content="Hello"
            createdAt="2026-05-12T10:00:00Z"
            sharedContent={{
                is_available: false,
                unavailable_message: "You can't view this content",
            }}
        />
    );

    expect(screen.getByText("You can't view this content")).toBeTruthy();
    expect(screen.getByText("Content unavailable")).toBeTruthy();
});
