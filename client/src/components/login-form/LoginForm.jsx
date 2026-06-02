import { useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { Link, useNavigate } from "react-router-dom";
import "./LoginForm.css";

import { StoreContext } from "../../";
import { Button, Card, Input } from "../ui";


function resolveLoginErrorMessage(error) {
    const detail = error?.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) {
        return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
        const firstDetail = detail[0];
        if (typeof firstDetail === "string" && firstDetail.trim()) {
            return firstDetail;
        }
        if (typeof firstDetail?.msg === "string" && firstDetail.msg.trim()) {
            return firstDetail.msg;
        }
    }

    if (error?.response?.status === 401) {
        return "Invalid username or password";
    }

    return "Sign in failed. Please try again.";
}


const LoginForm = () => {
    const { store } = useContext(StoreContext);
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await store.login(username, password);
            navigate("/");
        } catch (error) {
            setError(resolveLoginErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="login-form" variant="raised" padding="lg">
            <h1>Sign In</h1>

            <form onSubmit={(e) => { handleSubmit(e); }}>
                <Input
                    id="username"
                    type="text"
                    label="Username"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) {
                            setError("");
                        }
                    }}
                    required
                    autoFocus
                    fullWidth
                />

                <Input
                    id="password"
                    type="password"
                    label="Password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) {
                            setError("");
                        }
                    }}
                    required
                    fullWidth
                />

                {error ? <div className="login-error" role="alert">{error}</div> : null}

                <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={isLoading}
                >
                    Sign In
                </Button>
                <div className="hint">Don\'t have an account? <Link to="/signup">Sign Up</Link></div>
            </form>
        </Card>
    );
};

export default observer(LoginForm);
