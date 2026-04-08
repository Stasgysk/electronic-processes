import gsAxios from "./gsAxios";

export const getAdminProcesses = () =>
    gsAxios.get('/processes/admin', { withCredentials: true }).then(r => r.data);

export const updateProcessStatus = (id, status) =>
    gsAxios.patch(`/processes/${id}/status`, { status }, { withCredentials: true }).then(r => r.data);
