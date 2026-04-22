// Auth API calls — login, token refresh, and logout.
// login uses application/x-www-form-urlencoded because the backend expects
// the SSO token in form-encoded format.
// refresh sends the CSRF token in the x-csrf-token header as required by
// the CSRF middleware on the backend.
import gsAxios from "./gsAxios";

export const login = (body) => {
    return gsAxios.post("/auth/login", body, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
};

export const refresh = (csrfToken) => {
    return gsAxios.post("/auth/refresh", {}, {
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
        },
        withCredentials: true,
    }).then(res => res.data);
};

export const logout = () => {
    return gsAxios.post("/auth/logout", {}, {
        withCredentials: true,
    }).then(res => res.data);
};
