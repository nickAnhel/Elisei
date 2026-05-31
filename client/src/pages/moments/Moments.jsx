import { useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "./Moments.css";

import { StoreContext } from "../..";
import GlobalSearchInput from "../../components/global-search-input/GlobalSearchInput";
import AddIcon from "../../components/icons/AddIcon";
import SearchIcon from "../../components/icons/SearchIcon";
import MomentsViewer from "../videos/MomentsViewer";
import { Button, Card, IconButton } from "../../components/ui";


function Moments() {
    const { store } = useContext(StoreContext);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState("");
    const deepLinkedMomentId = searchParams.get("moment");

    useEffect(() => {
        const shouldResetToRecommendations = (
            searchParams.has("tab")
            || searchParams.has("section")
            || searchParams.has("feed")
        );
        if (!shouldResetToRecommendations) {
            return;
        }
        const nextSearchParams = new URLSearchParams();
        if (deepLinkedMomentId) {
            nextSearchParams.set("moment", deepLinkedMomentId);
        }
        setSearchParams(nextSearchParams, { replace: true });
    }, [deepLinkedMomentId, searchParams, setSearchParams]);

    return (
        <main className="moments-page">
            <div className="moments-mobile-actions" aria-label="Moment quick actions">
                {
                    store.isAuthenticated &&
                    <IconButton
                        type="button"
                        variant="default"
                        size="md"
                        className="moments-mobile-action-btn"
                        aria-label="Create moment"
                        onClick={() => navigate("/moments/new")}
                    >
                        <AddIcon />
                    </IconButton>
                }
                <IconButton
                    type="button"
                    variant="default"
                    size="md"
                    className="moments-mobile-action-btn"
                    aria-label="Search moments"
                    onClick={() => navigate("/search?type=moment")}
                >
                    <SearchIcon />
                </IconButton>
            </div>

            <Card className="moments-page-header" variant="raised">
                <div>
                    <h1>Moments</h1>
                </div>
                {
                    store.isAuthenticated &&
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => navigate("/moments/new")}
                    >
                        New moment
                    </Button>
                }
            </Card>
            <div className="moments-page-search">
                <GlobalSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSubmit={(query) => navigate(`/search?q=${encodeURIComponent(query)}&type=moment`)}
                    placeholder="Search moments and creators"
                />
            </div>
            <MomentsViewer />
        </main>
    );
}

export default Moments;
