import gsAxios from "./gsAxios";

export const getOrgUnitsTree = () =>
    gsAxios.get('/orgUnits', { withCredentials: true }).then(r => r.data);

export const getOrgUnitsFlat = () =>
    gsAxios.get('/orgUnits/flat', { withCredentials: true }).then(r => r.data);

export const getAllUsers = (filters = {}) =>
    gsAxios.get('/orgUnits/users', { params: filters, withCredentials: true }).then(r => r.data);

export const addUserWorkplace = (userId, orgUnitId) =>
    gsAxios.post(`/orgUnits/users/${userId}/workplaces`, { orgUnitId }, { withCredentials: true }).then(r => r.data);

export const removeUserWorkplace = (userId, wpId) =>
    gsAxios.delete(`/orgUnits/users/${userId}/workplaces/${wpId}`, { withCredentials: true }).then(r => r.data);

export const searchUsers = (email) =>
    gsAxios.get('/orgUnits/users/search', { params: { email }, withCredentials: true }).then(r => r.data);

export const assignUserOrgUnit = (userId, orgUnitId) =>
    gsAxios.put(`/orgUnits/users/${userId}`, { orgUnitId }, { withCredentials: true }).then(r => r.data);

export const createOrgUnit = (body) =>
    gsAxios.post('/orgUnits', body, { withCredentials: true }).then(r => r.data);

export const updateOrgUnit = (id, body) =>
    gsAxios.put(`/orgUnits/${id}`, body, { withCredentials: true }).then(r => r.data);

export const cloneOrgUnit = (id, body) =>
    gsAxios.post(`/orgUnits/${id}/clone`, body, { withCredentials: true }).then(r => r.data);

export const deleteOrgUnit = (id) =>
    gsAxios.delete(`/orgUnits/${id}`, { withCredentials: true }).then(r => r.data);
