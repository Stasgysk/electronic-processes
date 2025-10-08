import React, {createContext, useContext, useEffect, useRef, useState} from "react";
import { useAuth } from "./AuthContext";
import {me, putGroup} from "../api/user.service";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const { accessToken } = useAuth();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const didFetchUserRef = useRef(false);

    useEffect(() => {
        if (!accessToken) {
            setUser(null);
            setError(null);
            setLoading(false);
            return;
        }

        if (didFetchUserRef.current) return;

        const fetchUser = async () => {
            setLoading(true);
            try {
                const response = await me();
                setUser(response.data);
                didFetchUserRef.current = true;
            } catch (err) {
                setError(err);
                console.error("Failed to fetch user:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [accessToken]);

    const updateUser = async (newData) => {
        try {
            const user = await putGroup(newData);
            setUser(user.data);
        } catch (err) {
            console.log("Failed to update user:", err);
        }
    };

    return (
        <UserContext.Provider value={{ user, setUser, loading, error, updateUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error("useUser must be used within UserProvider");
    return context;
};
