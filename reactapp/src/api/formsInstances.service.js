// Form instance API calls — submitting, fetching awaiting/previous/filled steps.
//
// sendFilledForm   — posts a completed form step; body includes formData, formId,
//                    userId, and optionally processInstanceId (for approver steps).
// getAwaitingForms — returns WAITING form instances the current user needs to fill;
//                    optional formId+processInstanceId filters to a specific step.
// getPreviousFilledForms — loads already-completed steps for the same process,
//                          shown read-only above the current approver step.
// getFilledFormInstanceById — single filled step for the "filled with pid" view.
import gsAxios from "./gsAxios";

export const sendFilledForm = (body) => {
    return gsAxios.post(`/formsInstances`, body, {
        headers: {
            "Content-Type": "application/json",
        },
        withCredentials: true,
    }).then(res => res.data);
};

export const getAwaitingForms = (formId = null, processInstanceId = null) => {
    const filters = (formId && processInstanceId) ? { formId, processInstanceId } : {};
    return gsAxios.get(`/formsInstances/available`, {
        params: filters,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
};

export const getPreviousFilledForms = (params) => {
    return gsAxios.get(`/formsInstances/previous`, {
        params: params,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
}

export const getFilledFormInstanceById = (id) => {
    return gsAxios.get(`formsInstances/filled/${id}`, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
}