import React, {useEffect, useState} from "react";
import {useUser} from "../contexts/UserContext";
import {getAvailableForms} from "../api/forms.service";
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
                <p>{t("noAvailableForms")}</p>
            ) : (
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
                            <tr key={form.id} onClick={() => navigate(`/form/${form.id}`, { state: { form } })} style={{ cursor: "pointer" }}>
                                <td>{form.formName}</td>
                                <td>{new Date(form.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
