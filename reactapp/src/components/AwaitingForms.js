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
                                <th>{t("initialUserName")}</th>
                                <th>{t("createdAt")}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {props.forms.map((form) => (
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