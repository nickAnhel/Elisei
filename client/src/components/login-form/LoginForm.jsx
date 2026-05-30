import { useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { Link, useNavigate } from "react-router-dom";
import "./LoginForm.css";

import { StoreContext } from "../../";
import { Button, Card, Input } from "../ui";


const LoginForm = () => {
    const { store } = useContext(StoreContext);
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e) => {
        setIsLoading(true);
        e.preventDefault();

        try {
            await store.login(username, password);
            navigate("/");
        } catch (error) {
            console.log(error);
            console.log(error?.response?.data?.detail);
        }

        setIsLoading(false);
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
                    onChange={(e) => setUsername(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                />

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
