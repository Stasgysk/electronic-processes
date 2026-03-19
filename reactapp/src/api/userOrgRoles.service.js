import gsAxios from "./gsAxios";

export const getMyRoles = () =>
    gsAxios.get('/userOrgRoles/me', { withCredentials: true }).then(r => r.data);

export const getUserOrgRoles = (params) =>
    gsAxios.get('/userOrgRoles', { params, withCredentials: true }).then(r => r.data);

export const assignUserToRole = (body) =>
    gsAxios.post('/userOrgRoles', body, { withCredentials: true }).then(r => r.data);

export const joinRole = (orgRoleId, accessCode) =>
    gsAxios.post('/userOrgRoles/join', { orgRoleId, accessCode }, { withCredentials: true }).then(r => r.data);

export const removeUserFromRole = (id) =>
    gsAxios.delete(`/userOrgRoles/${id}`, { withCredentials: true }).then(r => r.data);
