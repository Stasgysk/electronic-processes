import gsAxios from "./gsAxios";

export const sendFilledForm = (body) => {
    return gsAxios.post(`/formsInstances`, body, {
        headers: {
            "Content-Type": "application/json",
        },
        withCredentials: true,
    }).then(res => res.data);
};

export const getAwaitingForms = (userGroupId, formId = null, processInstanceId = null) => {
    let filters;
    if(formId && processInstanceId) {
        filters = {userGroupId: userGroupId, formId: formId, processInstanceId: processInstanceId};
    } else {
        filters = {userGroupId: userGroupId};
    }
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