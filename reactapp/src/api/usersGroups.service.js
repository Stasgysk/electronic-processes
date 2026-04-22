// Fetches the full list of user groups (STUDENT, EMPLOYEE, ADMIN).
// Used during onboarding to look up the numeric id for a group name
// before calling PUT /users, because the backend expects an id, not a string.
import gsAxios from "./gsAxios";

export const getUsersGroups = () => {
    return gsAxios.get("/usersGroups", {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
};