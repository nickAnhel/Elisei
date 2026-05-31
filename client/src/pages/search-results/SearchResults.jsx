import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@siberiacancode/reactuse";

import "./SearchResults.css";

import GlobalSearchInput from "../../components/global-search-input/GlobalSearchInput";
import FeedContentCard from "../../components/feed-content-card/FeedContentCard";
import Loader from "../../components/loader/Loader";
import UserListItem from "../../components/user-list-item/UserListItem";
import SearchService from "../../service/SearchService";
import { Button, Card, EmptyState } from "../../components/ui";


const CONTENT_TYPES = [
    { value: "all", label: "All" },
    { value: "post", label: "Posts" },
    { value: "video", label: "Videos" },
    { value: "article", label: "Articles" },
    { value: "moment", label: "Moments" },
];

const SEARCH_TYPES = [
    ...CONTENT_TYPES,
    { value: "author", label: "Authors" },
];

const POPULAR_PERIODS = [
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
    { value: "all_time", label: "All time" },
];

const SEARCH_SORTS = [
    { value: "relevance", label: "Relevance" },
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
];

const DEFAULT_LIMIT = 20;
const DEFAULT_PERIOD = "week";
const DEFAULT_SORT = "relevance";
const POPULAR_AUTHORS_LIMIT = 6;

function parseNonNegativeInt(value, fallback) {
    const parsed = Number.parseInt(value || "", 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        return fallback;
    }
    return parsed;
}

function SearchResults() {
    const [searchParams, setSearchParams] = useSearchParams();

    const rawQuery = (searchParams.get("q") || "").trim();
    const isSearchMode = rawQuery.length > 0;

    const availableTypes = isSearchMode ? SEARCH_TYPES : CONTENT_TYPES;
    const rawType = searchParams.get("type");
    const type = availableTypes.some((item) => item.value === rawType)
        ? rawType
        : "all";

    const rawPeriod = searchParams.get("period");
    const period = POPULAR_PERIODS.some((item) => item.value === rawPeriod)
        ? rawPeriod
        : DEFAULT_PERIOD;

    const rawSort = searchParams.get("sort");
    const sort = SEARCH_SORTS.some((item) => item.value === rawSort)
        ? rawSort
        : DEFAULT_SORT;

    const offset = parseNonNegativeInt(searchParams.get("offset"), 0);
    const limit = Math.min(Math.max(parseNonNegativeInt(searchParams.get("limit"), DEFAULT_LIMIT), 1), 100);

    const [inputValue, setInputValue] = useState(rawQuery);

    useEffect(() => {
        setInputValue(rawQuery);
    }, [rawQuery]);

    const updateSearchParams = useCallback((mutate, options = {}) => {
        const nextParams = new URLSearchParams(searchParams);
        mutate(nextParams);
        setSearchParams(nextParams, options);
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (rawType && rawType === type) {
            return;
        }
        updateSearchParams((params) => {
            params.set("type", type);
        }, { replace: true });
    }, [rawType, type, updateSearchParams]);

    useEffect(() => {
        if (rawPeriod && rawPeriod === period) {
            return;
        }
        updateSearchParams((params) => {
            params.set("period", period);
        }, { replace: true });
    }, [rawPeriod, period, updateSearchParams]);

    useEffect(() => {
        if (!isSearchMode) {
            if (!rawSort) {
                return;
            }
            updateSearchParams((params) => {
                params.delete("sort");
            }, { replace: true });
            return;
        }

        if (rawSort && rawSort === sort) {
            return;
        }
        updateSearchParams((params) => {
            params.set("sort", sort);
        }, { replace: true });
    }, [isSearchMode, rawSort, sort, updateSearchParams]);

    useEffect(() => {
        const normalizedQuery = inputValue.trim();
        if (normalizedQuery === rawQuery) {
            return undefined;
        }

        const timerId = window.setTimeout(() => {
            updateSearchParams((params) => {
                if (normalizedQuery) {
                    params.set("q", normalizedQuery);
                } else {
                    params.delete("q");
                }
                params.set("offset", "0");
                params.set("limit", String(limit));
            }, { replace: true });
        }, 350);

        return () => window.clearTimeout(timerId);
    }, [inputValue, rawQuery, limit, updateSearchParams]);

    const { isLoading, isError, error, data } = useQuery(
        async () => {
            if (isSearchMode) {
                const response = await SearchService.search({
                    q: rawQuery,
                    type,
                    sort,
                    offset,
                    limit,
                });
                return response.data;
            }

            const response = await SearchService.popular({
                type,
                period,
                offset,
                limit,
            });
            return response.data;
        },
        {
            keys: [isSearchMode, rawQuery, type, sort, period, offset, limit],
        }
    );

    const {
        isLoading: isPopularAuthorsLoading,
        isError: isPopularAuthorsError,
        error: popularAuthorsError,
        data: popularAuthorsData,
    } = useQuery(
        async () => {
            if (isSearchMode) {
                return {
                    items: [],
                    offset: 0,
                    limit: POPULAR_AUTHORS_LIMIT,
                    has_more: false,
                };
            }
            const response = await SearchService.popularAuthors({
                period,
                offset: 0,
                limit: POPULAR_AUTHORS_LIMIT,
            });
            return response.data;
        },
        {
            keys: [isSearchMode, period],
        }
    );

    const items = data?.items || [];
    const hasMore = Boolean(data?.has_more);
    const popularAuthorItems = popularAuthorsData?.items || [];
    const errorMessage = isError
        ? (error?.response?.data?.detail || (isSearchMode ? "Failed to load search results" : "Failed to load popular content"))
        : "";

    const activeTypeLabel = useMemo(
        () => availableTypes.find((item) => item.value === type)?.label || "All",
        [availableTypes, type]
    );

    const resetOffset = () => {
        updateSearchParams((params) => {
            params.set("offset", "0");
        });
    };

    const loadMore = () => {
        updateSearchParams((params) => {
            params.set("offset", String(offset + limit));
        });
    };

    const renderPublicationResults = ({ emptyDescription }) => {
        if (isLoading) {
            return (
                <div className="search-results-loader">
                    <Loader />
                </div>
            );
        }

        if (isError) {
            return (
                <EmptyState
                    className="search-results-state"
                    title="Couldn't load results"
                    description={errorMessage}
                    action={<Button type="button" variant="secondary" onClick={resetOffset}>Retry</Button>}
                />
            );
        }

        if (items.length === 0) {
            return (
                <EmptyState
                    className="search-results-state"
                    title="Nothing found"
                    description={emptyDescription}
                />
            );
        }

        return (
            <>
                <div className="search-results-list">
                    {
                        items.map((item, index) => {
                            if (item.result_type === "content" && item.content) {
                                return (
                                    <FeedContentCard
                                        key={`content-${item.content.content_id}-${index}`}
                                        item={item.content}
                                        removeItem={() => {}}
                                    />
                                );
                            }

                            if (item.result_type === "author" && item.author) {
                                return (
                                    <div className="search-author-result" key={`author-${item.author.user_id}-${index}`}>
                                        <UserListItem user={item.author} />
                                    </div>
                                );
                            }

                            return null;
                        })
                    }
                </div>

                {
                    hasMore &&
                    <div className="search-results-pagination">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={loadMore}
                        >
                            Load more
                        </Button>
                    </div>
                }
            </>
        );
    };

    const renderPopularAuthors = () => {
        if (isPopularAuthorsLoading) {
            return (
                <div className="search-results-loader">
                    <Loader />
                </div>
            );
        }

        if (isPopularAuthorsError) {
            return (
                <EmptyState
                    className="search-results-state"
                    title="Couldn't load authors"
                    description={popularAuthorsError?.response?.data?.detail || "Failed to load popular authors"}
                />
            );
        }

        if (popularAuthorItems.length === 0) {
            return (
                <EmptyState
                    className="search-results-state"
                    title="No authors yet"
                    description="No popular authors found for this period."
                />
            );
        }

        return (
            <div className="search-results-list">
                {
                    popularAuthorItems.map((item, index) => {
                        if (!item.author) {
                            return null;
                        }
                        return (
                            <div className="search-author-result" key={`popular-author-${item.author.user_id}-${index}`}>
                                <UserListItem user={item.author} />
                            </div>
                        );
                    })
                }
            </div>
        );
    };

    return (
        <main id="search-results-page">
            <Card className="search-results-header" variant="raised">
                <h1>Search</h1>
                <p>
                    Discover posts, articles, videos, moments, and creators.
                </p>
                <GlobalSearchInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={(value) => {
                        updateSearchParams((params) => {
                            params.set("q", value);
                            params.set("offset", "0");
                            params.set("limit", String(limit));
                        });
                    }}
                    placeholder="Search by title, tags, text, or author"
                    autoFocus
                />
            </Card>

            <div className={`search-results-layout-shell ${isSearchMode ? "search-mode" : "popular-mode"}`}>
                <section className="search-results-controls">
                    <div className="search-type-filters" role="tablist" aria-label="Search filters">
                        {
                            availableTypes.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={type === item.value ? "active" : ""}
                                    onClick={() => {
                                        if (type === item.value) {
                                            return;
                                        }
                                        updateSearchParams((params) => {
                                            params.set("type", item.value);
                                            params.set("offset", "0");
                                        });
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))
                        }
                    </div>

                    {
                        isSearchMode &&
                        <label className="search-sort-control" htmlFor="search-sort-select">
                            <span>Sort</span>
                            <select
                                id="search-sort-select"
                                value={sort}
                                onChange={(event) => {
                                    const nextSort = event.target.value;
                                    updateSearchParams((params) => {
                                        params.set("sort", nextSort);
                                        params.set("offset", "0");
                                    });
                                }}
                            >
                                {
                                    SEARCH_SORTS.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))
                                }
                            </select>
                        </label>
                    }

                    {
                        !isSearchMode &&
                        <label className="search-sort-control" htmlFor="search-period-select">
                            <span>Period</span>
                            <select
                                id="search-period-select"
                                value={period}
                                onChange={(event) => {
                                    const nextPeriod = event.target.value;
                                    updateSearchParams((params) => {
                                        params.set("period", nextPeriod);
                                        params.set("offset", "0");
                                    });
                                }}
                            >
                                {
                                    POPULAR_PERIODS.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))
                                }
                            </select>
                        </label>
                    }
                </section>

                {
                    isSearchMode
                        ? (
                            <section className="search-results-single-column">
                                <section className="search-results-body">
                                    {renderPublicationResults({
                                        emptyDescription: `No results for "${rawQuery}" in ${activeTypeLabel}.`,
                                    })}
                                </section>
                            </section>
                        )
                        : (
                            <section className="search-popular-columns">
                                <section className="search-popular-column search-popular-publications">
                                    <h2>Popular publications</h2>
                                    <section className="search-results-body">
                                        {renderPublicationResults({
                                            emptyDescription: `No popular content for ${activeTypeLabel} in this period.`,
                                        })}
                                    </section>
                                </section>

                                <section className="search-popular-column search-popular-authors">
                                    <h2>Popular authors</h2>
                                    <section className="search-results-body">
                                        {renderPopularAuthors()}
                                    </section>
                                </section>
                            </section>
                        )
                }
            </div>
        </main>
    );
}

export default SearchResults;
