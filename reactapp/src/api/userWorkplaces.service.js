import gsAxios from "./gsAxios";

export const getMyWorkplaces = () => gsAxios.get('/userWorkplaces/me', { withCredentials: true });
export const addWorkplace = (orgUnitId) => gsAxios.post('/userWorkplaces', { orgUnitId }, { withCredentials: true });
export const removeWorkplace = (id) => gsAxios.delete(`/userWorkplaces/${id}`, { withCredentials: true });
