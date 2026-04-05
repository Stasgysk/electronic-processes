import gsAxios from "./gsAxios";

export const getSemesters = () =>
    gsAxios.get('/semesters', { withCredentials: true }).then(r => r.data);

export const createSemester = (data) =>
    gsAxios.post('/semesters', data, { withCredentials: true }).then(r => r.data);

export const updateSemester = (id, data) =>
    gsAxios.put(`/semesters/${id}`, data, { withCredentials: true }).then(r => r.data);

export const deleteSemester = (id) =>
    gsAxios.delete(`/semesters/${id}`, { withCredentials: true }).then(r => r.data);

export const activateSemester = (id) =>
    gsAxios.post(`/semesters/${id}/activate`, {}, { withCredentials: true }).then(r => r.data);

export const previewTransition = (toId, fromId) =>
    gsAxios.get(`/semesters/${toId}/transition/preview`, { params: { fromSemesterId: fromId }, withCredentials: true }).then(r => r.data);

export const transitionStudents = (toId, fromId) =>
    gsAxios.post(`/semesters/${toId}/transition/students`, { fromSemesterId: fromId }, { withCredentials: true }).then(r => r.data);

export const copyProfessors = (toId, fromId) =>
    gsAxios.post(`/semesters/${toId}/copy-professors`, { fromSemesterId: fromId }, { withCredentials: true }).then(r => r.data);
