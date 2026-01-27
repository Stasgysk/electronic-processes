import gsAxios from "./gsAxios";

export const getFilledProcessesAndFormsInstances = () => {
    return gsAxios.get(`/processesInstances/initialized`, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
}

export const getFilledProcessInstance = (processInstanceId) => {
    return gsAxios.get(`/processesInstances/initialized/${processInstanceId}`, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
    }).then(res => res.data);
}