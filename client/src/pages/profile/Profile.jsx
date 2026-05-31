import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Profile.css";

import { StoreContext } from "../..";

import Unauthorized from "../../components/unauthorized/Unauthorized";
import ProfileForm from "../../components/profile-form/ProfileForm";
import ProfileNotificationsSettings from "../../components/profile-notifications-settings/ProfileNotificationsSettings";
import ProfileAppearanceSettings from "../../components/profile-appearance-settings/ProfileAppearanceSettings";

const ALLOWED_TABS = new Set(["account", "notifications", "appearance"]);

function Profile() {
    const { store } = useContext(StoreContext);
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState("account");
    const requestedTab = searchParams.get("tab");

    useEffect(() => {
        if (requestedTab && ALLOWED_TABS.has(requestedTab)) {
            setActiveTab(requestedTab);
            return;
        }
        if (!requestedTab) {
            setActiveTab("account");
        }
    }, [requestedTab]);

    if (!store.isAuthenticated) {
        return (
            <div id="profile">
                <Unauthorized />
            </div>
        )
    }

    return (
        <div id="profile">
            <div className="profile-settings-layout">
                <aside className="profile-settings-tabs">
                    <button
                        type="button"
                        className={activeTab === "account" ? "active" : ""}
                        onClick={() => setActiveTab("account")}
                    >
                        Account
                    </button>
                    <button
                        type="button"
                        className={activeTab === "notifications" ? "active" : ""}
                        onClick={() => setActiveTab("notifications")}
                    >
                        Notifications
                    </button>
                    <button
                        type="button"
                        className={activeTab === "appearance" ? "active" : ""}
                        onClick={() => setActiveTab("appearance")}
                    >
                        Appearance
                    </button>
                </aside>
                <div className="profile-settings-content">
                    {activeTab === "account" && <ProfileForm />}
                    {activeTab === "notifications" && <ProfileNotificationsSettings />}
                    {activeTab === "appearance" && <ProfileAppearanceSettings />}
                </div>
            </div>
        </div>
    )
}

export default Profile;
