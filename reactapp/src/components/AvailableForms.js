// Lists the processes a user is allowed to start (the "Available forms" tab).
//
// The backend already filters the list to forms the current user is eligible for
// (matched by user group, direct email assignment, or org role), so this component
// just renders what it receives via props.
//
// Clicking a row navigates to FormsPage with type=start, passing the form object in
// router state so FormsPage doesn't have to fetch it again.

import React from "react";
import {useUser} from "../contexts/UserContext";
import {useTranslation} from "react-i18next";
import { useNavigate } from "react-router-dom";

export default function AvailableForms(props) {
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
                                <th>{t("createdAt")}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {props.forms.map((form) => (
                                // form.id is the starting-node Form row id;
                                // type=start tells FormsPage this is a fresh submission
                                <tr key={form.id} onClick={() => navigate(`/form/${form.id}?type=start`, { state: { form } })} style={{ cursor: "pointer" }}>
                                    {/* form.Processes.name is the human-readable process name set in n8n */}
                                    <td>{form.Processes.name}</td>
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
