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
