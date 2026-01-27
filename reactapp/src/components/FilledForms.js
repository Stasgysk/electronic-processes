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
                <p>{t("noAvailableForms")}</p>
            ) : (
                <div className="table-wrapper">
                    <table className="forms-table">
                        <thead>
                        <tr>
                            <th>{t("formName")}</th>
                            <th>{`${t("status")}/${t("initialUserName")}`}</th>
                            <th>{t("createdAt")}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {props.forms.processesInstances.map((processInstance) => (
                            <tr key={processInstance.id} onClick={() => navigate(`/form/${processInstance.id}?type=filled`, { state: { form: processInstance } })} style={{ cursor: "pointer" }}>
                                <td>{processInstance.name}</td>
                                <td>{processInstance.status}</td>
                                <td>{new Date(processInstance.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {props.forms.formsInstances.map((formInstance) => (
                            <tr key={formInstance.id} onClick={() => navigate(`/form/${formInstance.id}?processInstanceId=${formInstance.processInstanceId}&type=filled`, { state: { form: formInstance } })} style={{ cursor: "pointer" }}>
                                <td>{formInstance.formName}</td>
                                <td>{formInstance.initialUserName}</td>
                                <td>{new Date(formInstance.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}