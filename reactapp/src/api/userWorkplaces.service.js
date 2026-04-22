// UserWorkplace API calls — links a user to the org units where they work.
// Used during onboarding (addWorkplace) and in the profile/admin panel (remove).
// getMyWorkplaces returns the current user's own workplace list.
import gsAxios from "./gsAxios";

export const getMyWorkplaces = () => gsAxios.get('/userWorkplaces/me', { withCredentials: true });
export const addWorkplace = (orgUnitId) => gsAxios.post('/userWorkplaces', { orgUnitId }, { withCredentials: true });
export const removeWorkplace = (id) => gsAxios.delete(`/userWorkplaces/${id}`, { withCredentials: true });
