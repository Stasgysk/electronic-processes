import gsAxios from "./gsAxios";

export const getAvailableForms = (userGroupId) => {
    return gsAxios.get(`/forms/available/${userGroupId}`, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
};

export const getFormById = (id) => {
    return gsAxios.get(`/forms/${id}`, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
};
