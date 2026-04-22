// Fetches form definitions (not instances).
// getAvailableForms returns forms the current user can start — filtered by
// the backend based on user group / email / role.
// getFormById returns the full form definition for the FormsPage start flow.
import gsAxios from "./gsAxios";

export const getAvailableForms = () => {
    return gsAxios.get(`/forms/available`, {
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
