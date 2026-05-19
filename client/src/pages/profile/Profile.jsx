import { useContext, useState } from "react";
import "./Profile.css";

import { StoreContext } from "../..";

import Unauthorized from "../../components/unauthorized/Unauthorized";
import ProfileForm from "../../components/profile-form/ProfileForm";
import ProfileNotificationsSettings from "../../components/profile-notifications-settings/ProfileNotificationsSettings";


function Profile() {
    const { store } = useContext(StoreContext);
    const [activeTab, setActiveTab] = useState("account");

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
                </aside>
                <div className="profile-settings-content">
                    {activeTab === "account" && <ProfileForm />}
                    {activeTab === "notifications" && <ProfileNotificationsSettings />}
                </div>
            </div>
        </div>
    )
}

export default Profile;
