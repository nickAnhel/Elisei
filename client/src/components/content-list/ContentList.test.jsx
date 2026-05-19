import { act, render, screen, waitFor } from "@testing-library/react";

import ContentList from "./ContentList";


jest.mock("@siberiacancode/reactuse", () => {
    const React = require("react");
    return {
        useQuery: (query, options = {}) => {
            const { keys = [], onSuccess } = options;
            const [state, setState] = React.useState({
                isLoading: true,
                isError: false,
                error: null,
            });

            React.useEffect(() => {
                let cancelled = false;
                setState({
                    isLoading: true,
                    isError: false,
                    error: null,
                });
                Promise.resolve()
                    .then(() => query())
                    .then((data) => {
                        if (cancelled) {
                            return;
                        }
                        onSuccess?.(data);
                        setState({
                            isLoading: false,
                            isError: false,
                            error: null,
                        });
                    })
                    .catch((error) => {
                        if (cancelled) {
                            return;
                        }
                        setState({
                            isLoading: false,
                            isError: true,
                            error,
                        });
                    });

                return () => {
                    cancelled = true;
                };
            }, keys); // eslint-disable-line react-hooks/exhaustive-deps

            return state;
        },
    };
});

jest.mock("../loader/Loader", () => () => <div>Loading</div>);


const observerInstances = [];

class MockIntersectionObserver {
    constructor(callback) {
        this.callback = callback;
        observerInstances.push(this);
    }

    observe() {}

    disconnect() {}

    trigger(isIntersecting = true) {
        this.callback([{ isIntersecting }]);
    }
}


beforeEach(() => {
    observerInstances.length = 0;
    global.IntersectionObserver = MockIntersectionObserver;
});


test("ContentList uses pageSize for paging and keeps loading next portion", async () => {
    const fetchItems = jest.fn(async ({ offset, limit }) => ({
        data: offset === 0
            ? [{ content_id: "first" }]
            : [{ content_id: `next-${offset}` }],
    }));

    render(
        <ContentList
            fetchItems={fetchItems}
            filters={{ sort: "relevance" }}
            refresh="refresh-key"
            pageSize={10}
            renderItem={({ item, ref }) => (
                <div key={item.content_id} ref={ref}>
                    {item.content_id}
                </div>
            )}
        />
    );

    await waitFor(() => expect(fetchItems).toHaveBeenCalledWith({
        sort: "relevance",
        offset: 0,
        limit: 10,
    }));
    expect(screen.getByText("first")).not.toBeNull();

    await act(async () => {
        observerInstances[0].trigger(true);
    });

    await waitFor(() => expect(fetchItems).toHaveBeenCalledWith({
        sort: "relevance",
        offset: 10,
        limit: 10,
    }));
    expect(screen.getByText("next-10")).not.toBeNull();
});
