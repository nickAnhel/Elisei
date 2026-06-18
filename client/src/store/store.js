import { makeAutoObservable } from "mobx";
import axios from "axios";

import { APIUrl } from "../http";
import AuthService from "../service/AuthService";
import UserService from "../service/UserService";


export default class Store {
    user = {}
    isAuthenticated = false
    isLoading = false
    hasInitializedAuth = typeof window === "undefined"
        ? true
        : !Boolean(window.localStorage.getItem("token"))

    isRefreshPosts = false

    constructor() {
        makeAutoObservable(this);
    }

    setAuthenticated(value) {
        this.isAuthenticated = value;
    }

    setUser(user) {
        this.user = user;
    }

    setLoading(value) {
        this.isLoading = value;
    }

    setAuthInitialized(value) {
        this.hasInitializedAuth = value;
    }

    refreshPosts() {
        this.isRefreshPosts = !this.isRefreshPosts;
    }

    normalizeUser(user) {
        const userData = { ...user };
        delete userData.subscribers;
        delete userData.subscribed;
        return userData;
    }

    async loadCurrentUser() {
        const userRes = await UserService.getMe();
        this.setUser(this.normalizeUser(userRes.data));
    }

    async register(data) {
        const response = await AuthService.register(data);
        this.setUser(response.data);
        await this.login(data.username, data.password);
    }

    async login(username, password) {
        const response = await AuthService.login(username, password);
        localStorage.setItem('token', response.data.access_token);
        this.setAuthenticated(true);
        await this.loadCurrentUser();
        this.setAuthInitialized(true);
    }

    async logout() {
        try {
            await AuthService.logout();
            localStorage.removeItem('token');
            this.setAuthenticated(false);
            this.setUser({});
        } catch (e) {
            console.log(e?.response?.data?.detail)
        }
    }

    async checkAuth() {
        this.setLoading(true);
        try {
            const existingToken = localStorage.getItem("token");

            if (existingToken) {
                try {
                    await this.loadCurrentUser();
                    this.setAuthenticated(true);
                    return;
                } catch (tokenError) {
                    console.log(tokenError?.response?.data?.detail);
                }
            }

            const response = await axios.post(`${APIUrl}auth/refresh`);
            localStorage.setItem('token', response.data.access_token);
            await this.loadCurrentUser();
            this.setAuthenticated(true);
        } catch (e) {
            console.log(e?.response?.data?.detail);

            localStorage.removeItem('token');
            this.setAuthenticated(false);
            this.setUser({});
        } finally {
            this.setLoading(false);
            this.setAuthInitialized(true);
        }
    }
}
