// Lists the forms the current user has already submitted (the "Filled" tab).
//
// The backend returns two separate arrays:
//
//   props.forms.processesInstances
//     Processes that the user *initiated*. Each row shows the process name and its
//     current overall status (PROCESSING / ENDED). Clicking opens FormsPage with
//     type=filled (no processInstanceId), which renders all steps of the process.
//
//   props.forms.formsInstances
//     Individual form steps the user filled *as an approver* in someone else's process.
//     Each row shows the step name and the name of the person who started the process.
//     Clicking opens FormsPage with type=filled + processInstanceId, which shows only
//     that single filled step.

import {useUser} from "../contexts/UserContext";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import React from "react";

export default function AwaitingForms(props) {
    const { user } = useUser();
    const { t } = useTranslation();
    const navigate = useNavigate();

    if (!user) {
        return <div className="available-forms">{t("loginForForms")}</div>;
    }

    if (props.loading) {
        return <div className="available-forms">{t("loadingForms")}</div>;
    }

    if (props.error) {
        return <div className="available-forms error">{props.error}</div>;
    }

    return (
        <div className="available-forms">
            {props.forms.length === 0 ? (
                <p className="forms-empty">{t("noAvailableForms")}</p>
            ) : (
                <div className="forms-list-card">
                    <div className="table-wrapper">
                        <table className="forms-table">
                            <thead>
                            <tr>
                                <th>{t("formName")}</th>
                                {/* second column is "status" for processes the user started,
                                    or "who started it" for forms the user approved */}
                                <th>{`${t("status")}/${t("initialUserName")}`}</th>
                                <th>{t("createdAt")}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {/* processes the current user initiated — id is the ProcessInstance id */}
                            {props.forms.processesInstances.map((processInstance) => (
                                <tr key={processInstance.id} onClick={() => navigate(`/form/${processInstance.id}?type=filled`, { state: { form: processInstance } })} style={{ cursor: "pointer" }}>
                                    <td>{processInstance.name}</td>
                                    <td>{processInstance.status}</td>
                                    <td>{new Date(processInstance.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {/* individual steps this user filled as an approver — id is the FormInstance id */}
                            {props.forms.formsInstances.map((formInstance) => (
                                <tr key={formInstance.id} onClick={() => navigate(`/form/${formInstance.id}?processInstanceId=${formInstance.processInstanceId}&type=filled`, { state: { form: formInstance } })} style={{ cursor: "pointer" }}>
                                    <td>{formInstance.formName}</td>
                                    {/* shows the initiator's name so the approver can identify whose request it was */}
                                    <td>{formInstance.initialUserName}</td>
                                    <td>{new Date(formInstance.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
