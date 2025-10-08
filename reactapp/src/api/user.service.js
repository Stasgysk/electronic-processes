import gsAxios from "./gsAxios";

export const me = () => {
    return gsAxios.get("/users/me", {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
};

export const putGroup = (body) => {
    return gsAxios.put("/users", body,{
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
};
