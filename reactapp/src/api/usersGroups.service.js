import gsAxios from "./gsAxios";

export const getUsersGroups = () => {
    return gsAxios.get("/usersGroups", {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
};