import { createRef, useEffect, useRef, useState } from "react";
import { useQuery } from "@siberiacancode/reactuse";

import "./ContentList.css";

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
    }, [refresh, filtersKey]);

    const { isLoading, isError, error } = useQuery(
        async () => {
            const params = {
                ...filters,
                offset,
                limit: pageSize,
            };
            const res = await fetchItems(params);
            return res.data;
        },
        {
            keys: [offset, refresh, filtersKey],
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
            if (entries[0].isIntersecting && offset < pageSize * 10) {
                setOffset((prev) => prev + pageSize);
            }
        });

        if (lastItem.current) {
            observerLoader.current.observe(lastItem.current);
        }
    }, [lastItem, offset, pageSize]);

    if (isError) {
        console.log(error);
        return null;
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
                        ? <div className="content-list-empty">{emptyText}</div>
                        : null
                }
            </div>

            {
                isLoading &&
                <div className="content-list-loader">
                    <Loader />
                </div>
            }
        </div>
    );
}

export default ContentList;
