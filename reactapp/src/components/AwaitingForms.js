// Lists the form instances assigned to the current user that are waiting for their action
// (the "Awaiting" tab — these are forms where the user is an approver, not the initiator).
//
// Each row represents one WAITING form instance.  The backend enriches it with:
//   - form.name       →  "ProcessName/FormStepName" built server-side
//   - form.initialUserName  →  name of the person who started the whole process
//   - form.processInstanceId  →  needed in the URL so FormsPage fetches the right instance
//
// Clicking a row opens FormsPage with type=instance, which shows previous steps read-only
// above the form the approver needs to fill in.

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
                                {/* who submitted the original request — helps the approver identify the case */}
                                <th>{t("initialUserName")}</th>
                                <th>{t("createdAt")}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {props.forms.map((form) => (
                                // type=instance + processInstanceId tells FormsPage to load previous steps
                                // and show the current user's form below them for editing
                                <tr key={form.id} onClick={() => navigate(`/form/${form.id}?processInstanceId=${form.processInstanceId}&type=instance`, { state: { form } })} style={{ cursor: "pointer" }}>
                                    <td>{form.name}</td>
                                    <td>{form.initialUserName}</td>
                                    <td>{new Date(form.createdAt).toLocaleDateString()}</td>
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
