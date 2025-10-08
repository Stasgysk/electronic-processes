import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { login, logout, refresh } from "../api/auth.service";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [accessToken, setAccessToken] = useState(null);
    const [csrfToken, setCsrfToken] = useState(null);
    const [expiresIn, setExpiresIn] = useState(null);

    const didLoginRef = useRef(false);
    const isRefreshingRef = useRef(false);

    useEffect(() => {
        const initAuth = async () => {
            const storedAccessToken = localStorage.getItem("accessToken");
            const storedCsrfToken = localStorage.getItem("csrfToken");
            const storedExpiresIn = localStorage.getItem("expiresIn");

            if (storedAccessToken) {
                if (isRefreshingRef.current) return;
                isRefreshingRef.current = true;
                try {
                    const data = await refresh(storedCsrfToken);
                    if (data.status === "success") {
                        setAccessToken(data.data.accessToken);
                        setCsrfToken(storedCsrfToken);
                        setExpiresIn(Number(storedExpiresIn));
                        localStorage.setItem("accessToken", data.data.accessToken);
                        didLoginRef.current = true;
                        return;
                    }
                } catch (err) {
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("csrfToken");
                    localStorage.removeItem("expiresIn");
                } finally {
                    isRefreshingRef.current = false;
                }
            }

            if (didLoginRef.current) return;

            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");
            if (!code) return;

            didLoginRef.current = true;
            await loginWithCode(code).catch(err => console.error("Login failed", err));
        };

        initAuth();
    }, []);

    useEffect(() => {
        if (!accessToken) return;

        const interval = setInterval(async () => {
            try {
                const data = await refresh(csrfToken);
                if (data.status === "success") {
                    setAccessToken(data.data.accessToken);
                    localStorage.setItem("accessToken", data.data.accessToken);
                }
            } catch (err) {
                console.error("Token refresh failed", err);
            }
        }, (expiresIn * 0.75) * 1000);

        return () => clearInterval(interval);
    }, [accessToken, expiresIn, csrfToken]);

    const loginWithCode = async (code) => {
        const data = await login({ code });
        if (data.status === "success") {
            setAccessToken(data.data.accessToken);
            setCsrfToken(data.data.csrfToken);
            setExpiresIn(data.data.expiresIn);
            localStorage.setItem("accessToken", data.data.accessToken);
            localStorage.setItem("csrfToken", data.data.csrfToken);
            localStorage.setItem("expiresIn", data.data.expiresIn);
            window.history.replaceState({}, document.title, "/");
        }
    };

    const redirectToSSO = () => {
        window.location.href = `${process.env.REACT_APP_AUTH_URL}?client_id=${process.env.REACT_APP_CLIENT_ID}&redirect_uri=${encodeURIComponent(
            process.env.REACT_APP_REDIRECT_URI
        )}&response_type=${process.env.REACT_APP_RESPONSE_TYPE}&scope=${encodeURIComponent(process.env.REACT_APP_SCOPE)}&prompt=login`;
    };

    const logoutUser = async () => {
        await logout();
        setAccessToken(null);
        setCsrfToken(null);
        didLoginRef.current = false;
        localStorage.removeItem("accessToken");
        localStorage.removeItem("csrfToken");
        localStorage.removeItem("expiresIn");
    };

    return (
        <AuthContext.Provider
            value={{ accessToken, csrfToken, loginWithCode, redirectToSSO, logoutUser }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
