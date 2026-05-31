import "./ProfileAppearanceSettings.css";

import { useTheme } from "../../theme/ThemeProvider";


const THEME_LABELS = {
    system: "System",
    dark: "Dark",
    light: "Light",
};

function ProfileAppearanceSettings() {
    const { themeMode, setThemeMode, modes } = useTheme();

    return (
        <div className="profile-appearance-settings">
            <section className="profile-appearance-section">
                <h3>Appearance</h3>
                <div className="profile-appearance-row">
                    <div className="profile-appearance-info">
                        <div className="profile-appearance-title">App Theme</div>
                        <div className="profile-appearance-subtitle">
                            Select how Nerdex should look across the app.
                        </div>
                    </div>
                    <div className="profile-appearance-switcher" role="radiogroup" aria-label="App Theme">
                        {modes.map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                role="radio"
                                aria-checked={themeMode === mode}
                                className={themeMode === mode ? "active" : ""}
                                onClick={() => setThemeMode(mode)}
                            >
                                {THEME_LABELS[mode]}
                            </button>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}

export default ProfileAppearanceSettings;
