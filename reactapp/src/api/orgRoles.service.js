// OrgRole API calls — the role definitions attached to org units.
//
// getOrgRoles       — all roles for a specific org unit (used in admin panel).
// getBrowseableRoles — roles a user can self-join from their profile page;
//                      the backend filters out roles that are admin-only.
// createOrgRole / updateOrgRole / deleteOrgRole — admin CRUD.
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
