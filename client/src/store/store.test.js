import axios from "axios";

import Store from "./store";
import UserService from "../service/UserService";


jest.mock("axios", () => ({
    post: jest.fn(),
}));

jest.mock("../service/AuthService", () => ({
    __esModule: true,
    default: {
        register: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
    },
}));

jest.mock("../service/UserService", () => ({
    __esModule: true,
    default: {
        getMe: jest.fn(),
    },
}));

jest.mock("../http", () => ({
    APIUrl: "http://api.test/",
}));

describe("Store auth bootstrap", () => {
    let consoleLogSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    test("restores an existing session from the saved access token before using refresh", async () => {
        window.localStorage.setItem("token", "saved-access-token");
        UserService.getMe.mockResolvedValue({
            data: {
                user_id: "user-1",
                username: "demo-user",
                subscribers: [],
                subscribed: [],
            },
        });

        const store = new Store();
        await store.checkAuth();

        expect(UserService.getMe).toHaveBeenCalledTimes(1);
        expect(axios.post).not.toHaveBeenCalled();
        expect(store.isAuthenticated).toBe(true);
        expect(store.user).toEqual({
            user_id: "user-1",
            username: "demo-user",
        });
        expect(store.hasInitializedAuth).toBe(true);
        expect(store.isLoading).toBe(false);
    });

    test("falls back to refresh when the saved access token is no longer accepted", async () => {
        window.localStorage.setItem("token", "stale-access-token");
        UserService.getMe
            .mockRejectedValueOnce({
                response: {
                    data: {
                        detail: "unauthorized",
                    },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    user_id: "user-2",
                    username: "fresh-user",
                    subscribers: [],
                    subscribed: [],
                },
            });
        axios.post.mockResolvedValue({
            data: {
                access_token: "fresh-access-token",
            },
        });

        const store = new Store();
        await store.checkAuth();

        expect(axios.post).toHaveBeenCalledWith("http://api.test/auth/refresh");
        expect(window.localStorage.getItem("token")).toBe("fresh-access-token");
        expect(store.isAuthenticated).toBe(true);
        expect(store.user).toEqual({
            user_id: "user-2",
            username: "fresh-user",
        });
        expect(store.hasInitializedAuth).toBe(true);
    });
});
