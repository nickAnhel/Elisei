import { useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { Link, useNavigate } from "react-router-dom";

import "./SignUpForm.css";

import { StoreContext } from "../../";
import { Button, Card, Input, Textarea } from "../ui";


function isValidHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_error) {
        return false;
    }
}


const SignUpForm = () => {
    const { store } = useContext(StoreContext);
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [links, setLinks] = useState([{ label: "", url: "" }]);

    const setLinkField = (index, field, value) => {
        setLinks((prev) => prev.map((item, itemIndex) => {
            if (itemIndex !== index) {
                return item;
            }
            return {
                ...item,
                [field]: value,
            };
        }));
    };

    const addLinkRow = () => {
        setLinks((prev) => [...prev, { label: "", url: "" }]);
    };

    const removeLinkRow = (index) => {
        setLinks((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    };

    const buildLinksPayload = () => {
        const payload = [];
        for (const row of links) {
            const label = row.label.trim();
            const url = row.url.trim();

            if (!label && !url) {
                continue;
            }
            if (!label || !url) {
                throw new Error("Fill both label and URL for each link");
            }
            if (!isValidHttpUrl(url)) {
                throw new Error("Link URL must start with http:// or https://");
            }

            payload.push({ label, url });
        }
        return payload;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!/^[A-Za-z0-9._-]{1,32}$/.test(username)) {
            setError("Invalid username");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        let linksPayload;
        try {
            linksPayload = buildLinksPayload();
        } catch (validationError) {
            setError(validationError.message || "Invalid links");
            return;
        }

        setIsLoading(true);

        try {
            await store.register({
                username: username.trim(),
                display_name: displayName.trim() || null,
                bio: bio.trim() || null,
                links: linksPayload,
                password,
            });
            navigate("/");
        } catch (requestError) {
            setError(requestError?.response?.data?.detail || "Registration failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="singup-form" variant="raised" padding="lg">
            <h1>Sign Up</h1>

            <form onSubmit={handleSubmit}>
                <Input
                    id="username"
                    type="text"
                    label="Username"
                    placeholder="Username"
                    value={username}
                    pattern="^[A-Za-z0-9._-]{1,32}$"
                    maxLength={32}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    fullWidth
                />

                <Input
                    id="display-name"
                    type="text"
                    label="Display name"
                    placeholder="Display name"
                    value={displayName}
                    maxLength={64}
                    onChange={(e) => setDisplayName(e.target.value)}
                    fullWidth
                />

                <Textarea
                    id="bio"
                    label="Bio"
                    placeholder="Tell people about yourself"
                    value={bio}
                    maxLength={500}
                    onChange={(e) => setBio(e.target.value)}
                    fullWidth
                />

                <div className="signup-field-group">
                    <label className="signup-field-label">Links</label>
                    <div className="signup-links-block">
                        {links.map((link, index) => (
                            <div className="signup-link-row" key={`signup-link-${index}`}>
                                <Input
                                    type="text"
                                    placeholder="Label"
                                    value={link.label}
                                    maxLength={32}
                                    onChange={(e) => setLinkField(index, "label", e.target.value)}
                                    fullWidth
                                />
                                <Input
                                    type="url"
                                    placeholder="https://example.com"
                                    value={link.url}
                                    onChange={(e) => setLinkField(index, "url", e.target.value)}
                                    fullWidth
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="signup-link-remove"
                                    onClick={() => removeLinkRow(index)}
                                    disabled={links.length === 1}
                                >
                                    Remove
                                </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            className="signup-link-add"
                            onClick={addLinkRow}
                        >
                            Add link
                        </Button>
                    </div>
                </div>

                <Input
                    id="password"
                    type="password"
                    label="Password"
                    placeholder="Password"
                    value={password}
                    minLength={8}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                />

                <Input
                    id="confirm-password"
                    type="password"
                    label="Confirm password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    minLength={8}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    fullWidth
                />

                {error ? <div className="signup-error">{error}</div> : null}

                <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={isLoading}
                >
                    Sign Up
                </Button>

                <div className="hint">Already have an account? <Link to="/login">Sign In</Link></div>
            </form>
        </Card>
    );
};


export default observer(SignUpForm);
