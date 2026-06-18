import { useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./FeedSidebar.css";

import { StoreContext } from "../..";
import PostService from "../../service/PostService";

import GlobalSearchInput from "../global-search-input/GlobalSearchInput";
import PostModal from "../post-modal/PostModal";
import { Tabs, TabsList, TabsTrigger } from "../ui";


const FEED_TABS = {
    recommendations: "recommendations",
    subscriptions: "subscriptions",
};

function normalizeTab(tab, isAuthenticated) {
    if (tab === FEED_TABS.subscriptions) {
        return isAuthenticated ? tab : FEED_TABS.recommendations;
    }
    return FEED_TABS.recommendations;
}


function FeedSidebar() {
    const { store } = useContext(StoreContext);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [isCreatePostModalActive, setIsCreatePostModalActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const requestedTab = searchParams.get("tab") || FEED_TABS.recommendations;
    const activeTab = normalizeTab(requestedTab, store.isAuthenticated);

    useEffect(() => {
        if (requestedTab === activeTab) {
            return;
        }
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("tab", activeTab);
        setSearchParams(nextSearchParams, { replace: true });
    }, [activeTab, requestedTab, searchParams, setSearchParams]);

    const setTab = (tab) => {
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("tab", tab);
        setSearchParams(nextSearchParams);
    };

    const buildCreatedPostLocation = (post) => {
        const username = post?.user?.username || store.user?.username;
        if (!post?.post_id || !username) {
            return "/feed";
        }
        return `/people/@${username}?p=${post.post_id}`;
    };

    return (
        <div id="feed-sidebar">
            <GlobalSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={(query) => navigate(`/search?q=${encodeURIComponent(query)}&type=all`)}
                placeholder="Search all content"
                inputTestId="feed-search-input"
                submitTestId="feed-search-submit"
            />

            <Tabs value={activeTab} onValueChange={setTab}>
                <TabsList className="feed-sidebar-tabs" aria-label="Feed tabs">
                    <TabsTrigger value={FEED_TABS.recommendations}>
                        Recommendations
                    </TabsTrigger>
                    {
                        store.isAuthenticated &&
                        <TabsTrigger value={FEED_TABS.subscriptions}>
                            Subscriptions
                        </TabsTrigger>
                    }
                </TabsList>
            </Tabs>

            {
                store.isAuthenticated &&
                <>
                    <hr />

                    <button
                        className="btn btn-primary btn-block"
                        onClick={() => { setIsCreatePostModalActive(true); }}
                        data-testid="create-post-trigger"
                    >
                        Create Post
                    </button>
                </>
            }

            <PostModal
                active={isCreatePostModalActive}
                setActive={setIsCreatePostModalActive}
                savePostFunc={PostService.createPost}
                modalHeader={"Create new post"}
                buttonText={"Create"}
                navigateTo={buildCreatedPostLocation}
            />
        </div>
    );
}

export default FeedSidebar;
