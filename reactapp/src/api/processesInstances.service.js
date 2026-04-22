// Process instance API calls used by the Filled tab and the filled view in FormsPage.
//
// getFilledProcessesAndFormsInstances — returns both arrays the FilledForms component
//   needs: processesInstances (processes the user started) and formsInstances
//   (individual steps the user approved in someone else's process).
// getFilledProcessInstance — loads one process instance with all its nested
//   formsInstances for the full read-only view.
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