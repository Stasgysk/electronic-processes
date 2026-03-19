import gsAxios from "./gsAxios";

export const getOrgRoles = (orgUnitId) =>
    gsAxios.get('/orgRoles', { params: { orgUnitId }, withCredentials: true }).then(r => r.data);

export const getBrowseableRoles = () =>
    gsAxios.get('/orgRoles/browseable', { withCredentials: true }).then(r => r.data);

export const createOrgRole = (body) =>
    gsAxios.post('/orgRoles', body, { withCredentials: true }).then(r => r.data);

export const updateOrgRole = (id, body) =>
    gsAxios.patch(`/orgRoles/${id}`, body, { withCredentials: true }).then(r => r.data);

export const deleteOrgRole = (id) =>
    gsAxios.delete(`/orgRoles/${id}`, { withCredentials: true }).then(r => r.data);
