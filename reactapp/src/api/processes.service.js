// Process definition API calls used by the admin panel.
// getAdminProcesses returns all processes with submission/awaiting counts.
// updateProcessStatus toggles a process between PUBLISHED and DRAFT so the
// admin can hide a form from users without deleting it.
import gsAxios from "./gsAxios";

export const getAdminProcesses = () =>
    gsAxios.get('/processes/admin', { withCredentials: true }).then(r => r.data);

export const updateProcessStatus = (id, status) =>
    gsAxios.patch(`/processes/${id}/status`, { status }, { withCredentials: true }).then(r => r.data);
