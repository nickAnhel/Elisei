import { createRef, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@siberiacancode/reactuse";

import "./ContentList.css";

import {
    Button,
    Card,
    EmptyState,
    Skeleton,
} from "../ui";
import Loader from "../loader/Loader";

function ContentList({
    fetchItems,
    filters,
    refresh,
    renderItem,
    pageSize = 5,
    emptyText = "Nothing here yet",
    onItemsChange = null,
}) {
    const lastItem = createRef();
    const observerLoader = useRef();
    const filtersKey = JSON.stringify(filters || {});

    const [items, setItems] = useState([]);
    const [offset, setOffset] = useState(0);
    const [retryKey, setRetryKey] = useState(0);

    const removeItem = (itemId) => {
        setItems((prevItems) => {
            const nextItems = prevItems.filter((item) => (
                item.content_id !== itemId
                && item.article_id !== itemId
                && item.moment_id !== itemId
                && item.content?.content_id !== itemId
            ));
            onItemsChange?.(nextItems);
            return nextItems;
        });
    };

    useEffect(() => {
        setOffset(0);
        setItems([]);
        setRetryKey(0);
    }, [refresh, filtersKey]);

    const { isLoading, isError, error } = useQuery(
        async () => {
            const params = {
                ...filters,
                offset,
                limit: pageSize,
            };
            const res = await fetchItems(params);
            return Array.isArray(res.data) ? res.data : [];
        },
        {
            keys: [offset, refresh, filtersKey, retryKey],
            onSuccess: (fetchedItems) => {
                setItems((prevItems) => {
                    const nextItems = (
                        offset === 0
                            ? fetchedItems
                            : [...prevItems, ...fetchedItems]
                    );
                    onItemsChange?.(nextItems);
                    return nextItems;
                });
            },
        }
    );

    useEffect(() => {
        if (observerLoader.current) {
            observerLoader.current.disconnect();
        }

        observerLoader.current = new IntersectionObserver((entries) => {
            if (isLoading || isError) {
                return;
            }
            if (entries[0].isIntersecting && offset < pageSize * 10) {
                setOffset((prev) => prev + pageSize);
            }
        });

        if (lastItem.current) {
            observerLoader.current.observe(lastItem.current);
        }

        return () => observerLoader.current?.disconnect();
    }, [isError, isLoading, lastItem, offset, pageSize]);

    const isInitialLoading = isLoading && items.length === 0;
    const isLoadingMore = isLoading && items.length > 0;

    const errorMessage = useMemo(() => {
        if (!isError) {
            return "";
        }
        return error?.response?.data?.detail || "Failed to load content.";
    }, [error, isError]);

    const retryFetch = () => {
        setRetryKey((value) => value + 1);
    };

    if (isInitialLoading) {
        return (
            <div className="content-list">
                <div className="content-list-items content-list-skeletons">
                    {Array.from({ length: Math.max(3, Math.min(pageSize, 5)) }).map((_, index) => (
                        <Card key={`content-list-skeleton-${index}`} className="content-list-skeleton-card" variant="raised">
                            <div className="content-list-skeleton-head">
                                <Skeleton variant="circle" />
                                <div className="content-list-skeleton-head-lines">
                                    <Skeleton variant="text" width="8rem" />
                                    <Skeleton variant="text" width="5rem" />
                                </div>
                            </div>
                            <Skeleton variant="text" width="70%" />
                            <Skeleton variant="text" width="92%" />
                            <Skeleton variant="text" width="56%" />
                            <Skeleton variant="block" height="11rem" />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (isError && items.length === 0) {
        return (
            <div className="content-list">
                <EmptyState
                    className="content-list-empty-state"
                    title="Couldn't load content"
                    description={errorMessage}
                    action={(
                        <Button type="button" variant="secondary" onClick={retryFetch}>
                            Retry
                        </Button>
                    )}
                />
            </div>
        );
    }

    return (
        <div className="content-list">
            <div className="content-list-items">
                {
                    items.map((item, index) => renderItem({
                        item,
                        removeItem,
                        ref: index + 1 === items.length ? lastItem : null,
                    }))
                }
                {
                    !isLoading && items.length === 0
                        ? (
                            <EmptyState
                                className="content-list-empty-state"
                                title="Nothing found"
                                description={emptyText}
                            />
                        )
                        : null
                }
            </div>

            {
                isError && items.length > 0 &&
                <Card className="content-list-inline-error" variant="muted">
                    <span>{errorMessage}</span>
                    <Button type="button" variant="outline" size="sm" onClick={retryFetch}>Retry</Button>
                </Card>
            }

            {
                isLoadingMore &&
                <div className="content-list-loader">
                    <Loader />
                </div>
            }
        </div>
    );
}

export default ContentList;
