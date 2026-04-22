// Current user API calls.
// me()       — fetches the logged-in user's full profile including group and org unit.
//              Called by UserContext on app load and after onboarding completes.
// putGroup() — updates the user's group and/or org unit.  Used by the onboarding
//              modal when a new employee or admin selects their workplaces.
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
