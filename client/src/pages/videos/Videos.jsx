import { useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "./Videos.css";

import { StoreContext } from "../..";
import ContentList from "../../components/content-list/ContentList";
import VideoCard from "../../components/video-card/VideoCard";
import ContentService from "../../service/ContentService";
import GlobalSearchInput from "../../components/global-search-input/GlobalSearchInput";
import { Button, Card, Tabs, TabsList, TabsTrigger } from "../../components/ui";


const VIDEO_TABS = {
    recommendations: "recommendations",
    subscriptions: "subscriptions",
};

const RECOMMENDATION_SORTS = [
    { id: "relevance", label: "Relevance" },
    { id: "newest", label: "Newest" },
    { id: "oldest", label: "Oldest" },
];

const SUBSCRIPTION_SORTS = [
    { id: "newest", label: "Newest" },
    { id: "oldest", label: "Oldest" },
];

function normalizeSort(tab, sort) {
    const allowedSorts = tab === VIDEO_TABS.subscriptions
        ? SUBSCRIPTION_SORTS
        : RECOMMENDATION_SORTS;
    const fallback = allowedSorts[0].id;
    return allowedSorts.some((option) => option.id === sort) ? sort : fallback;
}


function Videos() {
    const { store } = useContext(StoreContext);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState("");
    const requestedTab = searchParams.get("tab") || VIDEO_TABS.recommendations;
    const requestedSort = searchParams.get("sort") || "relevance";
    const activeTab = (
        requestedTab === VIDEO_TABS.subscriptions && store.isAuthenticated
            ? VIDEO_TABS.subscriptions
            : VIDEO_TABS.recommendations
    );
    const activeSort = normalizeSort(activeTab, requestedSort);

    useEffect(() => {
        if (requestedTab !== activeTab || requestedSort !== activeSort) {
            setSearchParams({
                tab: activeTab,
                sort: activeSort,
            }, { replace: true });
        }
    }, [activeSort, activeTab, requestedSort, requestedTab, setSearchParams]);

    const setTab = (tab) => {
        setSearchParams({
            tab,
            sort: normalizeSort(tab, activeSort),
        });
    };

    const setSort = (sort) => {
        setSearchParams({
            tab: activeTab,
            sort,
        });
    };

    const availableSorts = activeTab === VIDEO_TABS.subscriptions
        ? SUBSCRIPTION_SORTS
        : RECOMMENDATION_SORTS;

    const fetchItems = activeTab === VIDEO_TABS.subscriptions
        ? ContentService.getVideoSubscriptions
        : ContentService.getVideoRecommendations;
    const filters = activeTab === VIDEO_TABS.subscriptions
        ? {
            order: "published_at",
            desc: activeSort !== "oldest",
        }
        : {
            sort: activeSort,
        };
    const emptyText = activeTab === VIDEO_TABS.subscriptions
        ? "No videos from subscriptions"
        : "No video recommendations yet";

    return (
        <div id="videos-page">
            <Card className="videos-page-header" variant="raised">
                <div>
                    <h1>Videos</h1>
                </div>
                {
                    store.isAuthenticated &&
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => navigate("/videos/new")}
                    >
                        New video
                    </Button>
                }
            </Card>

            <GlobalSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={(query) => navigate(`/search?q=${encodeURIComponent(query)}&type=video`)}
                placeholder="Search videos and creators"
            />

            <div className="videos-page-toolbar">
                <Tabs value={activeTab} onValueChange={setTab}>
                    <TabsList className="videos-page-sections" aria-label="Video sections">
                        <TabsTrigger value={VIDEO_TABS.recommendations}>
                            Recommendations
                        </TabsTrigger>
                        {
                            store.isAuthenticated &&
                            <TabsTrigger value={VIDEO_TABS.subscriptions}>
                                Subscriptions
                            </TabsTrigger>
                        }
                    </TabsList>
                </Tabs>

                <label className="videos-page-sort" htmlFor="videos-sort-select">
                    <span>Sort</span>
                    <select
                        id="videos-sort-select"
                        value={activeSort}
                        onChange={(event) => setSort(event.target.value)}
                    >
                        {availableSorts.map((sortOption) => (
                            <option key={sortOption.id} value={sortOption.id}>
                                {sortOption.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <ContentList
                key={`videos-${activeTab}-${activeSort}`}
                fetchItems={fetchItems}
                filters={filters}
                pageSize={activeTab === VIDEO_TABS.recommendations ? 10 : 5}
                refresh={`${store.isRefreshPosts}-${activeTab}-${activeSort}`}
                emptyText={emptyText}
                renderItem={({ item, removeItem, ref }) => (
                    <VideoCard
                        key={item.video_id || item.content_id}
                        ref={ref}
                        video={{
                            ...item,
                            video_id: item.video_id || item.content_id,
                        }}
                        removeItem={removeItem}
                    />
                )}
            />
        </div>
    );
}

export default Videos;
