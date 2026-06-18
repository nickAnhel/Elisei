import { fireEvent, render, screen, waitFor } from "@testing-library/react";

let mockStore = {
    refreshPosts: jest.fn(),
};

jest.mock("../..", () => ({
    StoreContext: require("react").createContext({
        get store() {
            return mockStore;
        },
    }),
}));

jest.mock("react-router-dom", () => ({
    useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../modal/Modal", () => ({ children }) => <div>{children}</div>);
jest.mock("../tag-input/TagInput", () => () => <div data-testid="post-tag-input" />);

jest.mock("../../service/AssetService", () => ({
    __esModule: true,
    default: {
        initUpload: jest.fn(),
        uploadFile: jest.fn(),
        finalizeUpload: jest.fn(),
    },
}));

import AssetService from "../../service/AssetService";
import PostModal from "./PostModal";


beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {
        refreshPosts: jest.fn(),
    };
    global.URL.createObjectURL = jest.fn(() => "blob:post-preview");
    global.URL.revokeObjectURL = jest.fn();
    AssetService.initUpload.mockImplementation(() => new Promise(() => {}));
});

test("shows a local preview immediately after media selection", async () => {
    render(
        <PostModal
            active={true}
            setActive={jest.fn()}
            content=""
            savePostFunc={jest.fn()}
            modalHeader="Create post"
            buttonText="Publish"
        />
    );

    const mediaInput = screen.getByTestId("post-media-input");
    const file = new File(["image"], "cover.png", { type: "image/png" });

    fireEvent.change(mediaInput, {
        target: {
            files: [file],
        },
    });

    await waitFor(() => {
        expect(screen.getByAltText("cover.png").getAttribute("src")).toBe("blob:post-preview");
    });
});

test("keeps using the local preview after upload succeeds", async () => {
    AssetService.initUpload.mockResolvedValue({
        data: {
            upload_url: "https://upload.example/file",
            upload_headers: {},
            asset: {
                asset_id: "asset-1",
            },
        },
    });
    AssetService.uploadFile.mockResolvedValue({
        ok: true,
        text: async () => "",
    });
    AssetService.finalizeUpload.mockResolvedValue({
        data: {
            asset: {
                asset_id: "asset-1",
                asset_type: "image",
                original_filename: "cover.png",
                size_bytes: 5,
                variants: [
                    {
                        asset_variant_type: "original",
                        url: "https://cdn.example/cover.png",
                        mime_type: "image/png",
                    },
                ],
            },
        },
    });

    render(
        <PostModal
            active={true}
            setActive={jest.fn()}
            content=""
            savePostFunc={jest.fn()}
            modalHeader="Create post"
            buttonText="Publish"
        />
    );

    fireEvent.change(screen.getByTestId("post-media-input"), {
        target: {
            files: [new File(["image"], "cover.png", { type: "image/png" })],
        },
    });

    await waitFor(() => {
        expect(AssetService.finalizeUpload).toHaveBeenCalledWith("asset-1");
    });

    expect(screen.getByAltText("cover.png").getAttribute("src")).toBe("blob:post-preview");
    expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:post-preview");
});
