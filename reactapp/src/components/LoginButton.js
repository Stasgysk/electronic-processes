import React from "react";
import './LoginButton.css'
import { useAuth } from "../contexts/AuthContext";

export default function LoginButton() {
    const { accessToken, redirectToSSO, logoutUser } = useAuth();

    return (
        <div>
            {!accessToken ? (
                <button onClick={redirectToSSO} className="login-button">Login</button>
            ) : (
                <button onClick={logoutUser} className="login-button">Logout</button>
            )}
        </div>
    );
}
