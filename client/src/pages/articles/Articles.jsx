import { useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "./Articles.css";

import { StoreContext } from "../..";
import ContentService from "../../service/ContentService";

import ContentList from "../../components/content-list/ContentList";
import ArticleCard from "../../components/article-card/ArticleCard";
import GlobalSearchInput from "../../components/global-search-input/GlobalSearchInput";
import { Button, Card, Select, Tabs, TabsList, TabsTrigger } from "../../components/ui";

const ARTICLE_TABS = {
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
    const allowedSorts = tab === ARTICLE_TABS.subscriptions
        ? SUBSCRIPTION_SORTS
        : RECOMMENDATION_SORTS;
    const fallback = allowedSorts[0].id;
    return allowedSorts.some((option) => option.id === sort) ? sort : fallback;
}


function Articles() {
    const { store } = useContext(StoreContext);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState("");
    const requestedTab = searchParams.get("tab") || ARTICLE_TABS.recommendations;
    const requestedSort = searchParams.get("sort") || "relevance";
    const activeTab = (
        requestedTab === ARTICLE_TABS.subscriptions && store.isAuthenticated
            ? ARTICLE_TABS.subscriptions
            : ARTICLE_TABS.recommendations
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

    const availableSorts = activeTab === ARTICLE_TABS.subscriptions
        ? SUBSCRIPTION_SORTS
        : RECOMMENDATION_SORTS;

    const fetchItems = activeTab === ARTICLE_TABS.subscriptions
        ? ContentService.getSubscriptionsFeed
        : ContentService.getRecommendationsFeed;
    const filters = activeTab === ARTICLE_TABS.subscriptions
        ? {
            content_type: "article",
            order: "published_at",
            desc: activeSort !== "oldest",
        }
        : {
            content_type: "article",
            sort: activeSort,
        };
    const emptyText = activeTab === ARTICLE_TABS.subscriptions
        ? "No articles from subscriptions"
        : "No article recommendations yet";

    return (
        <div id="articles-page">
            <Card className="articles-page-header" variant="raised">
                <div>
                    <h1>Articles</h1>
                </div>
                {
                    store.isAuthenticated &&
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => navigate("/articles/new")}
                    >
                        Write article
                    </Button>
                }
            </Card>

            <GlobalSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={(query) => navigate(`/search?q=${encodeURIComponent(query)}&type=article`)}
                placeholder="Search articles and creators"
            />

            <div className="articles-page-toolbar">
                <Tabs value={activeTab} onValueChange={setTab}>
                    <TabsList className="articles-page-sections" aria-label="Article sections">
                        <TabsTrigger value={ARTICLE_TABS.recommendations}>
                            Recommendations
                        </TabsTrigger>
                        {
                            store.isAuthenticated &&
                            <TabsTrigger value={ARTICLE_TABS.subscriptions}>
                                Subscriptions
                            </TabsTrigger>
                        }
                    </TabsList>
                </Tabs>

                <Select
                    className="articles-page-sort"
                    fitToOptions
                    label="Sort"
                    value={activeSort}
                    onChange={(event) => setSort(event.target.value)}
                >
                        {availableSorts.map((sortOption) => (
                            <option key={sortOption.id} value={sortOption.id}>
                                {sortOption.label}
                            </option>
                        ))}
                </Select>
            </div>

            <ContentList
                key={`articles-${activeTab}-${activeSort}`}
                fetchItems={fetchItems}
                filters={filters}
                pageSize={activeTab === ARTICLE_TABS.recommendations ? 10 : 5}
                refresh={`${store.isRefreshPosts}-${activeTab}-${activeSort}`}
                emptyText={emptyText}
                renderItem={({ item, removeItem, ref }) => (
                    <ArticleCard
                        key={item.article_id || item.content_id}
                        ref={ref}
                        article={{
                            ...item,
                            article_id: item.article_id || item.content_id,
                        }}
                        removeItem={removeItem}
                    />
                )}
            />
        </div>
    );
}

export default Articles;
