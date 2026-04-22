// Form view page — handles three distinct modes controlled by the ?type= query param:
//
//   type=start
//     User is filling in a form for the first time.
//     Form definition is fetched by id from /forms/:id.
//     On submit: sends formData + formId + userId (no processInstanceId).
//
//   type=instance
//     User is an approver filling in their step of an existing process.
//     Previous steps are loaded from /formsInstances/previous and shown as
//     collapsible accordion sections above the active form.
//     On submit: body includes processInstanceId so the backend can link the step.
//
//   type=filled (without processInstanceId)
//     User views a process they initiated — all steps read-only.
//     Loads from /processesInstances/initialized/:id (returns the full process
//     with nested formsInstances array), sorted by updatedAt.
//
//   type=filled (with processInstanceId)
//     User views a single form step they approved — read-only.
//     Loads from /formsInstances/filled/:id.
//
// handleChange initialises formValues from form.formData on the first keystroke
// (when formValues is still []) so the array is always parallel to formData groups.
// Validation runs per field; errors are stored on the field object as .error.
//
// File fields hold a File object in formValues.  convertFilesToBase64 replaces all
// File objects with base64 strings before the body is POSTed to /formsInstances.
//
// After submission navigate("/") passes state.refresh=true so App.js bumps its
// refreshKey and all three form lists reload.

import {useLocation, useNavigate, useParams} from "react-router-dom";
import {useEffect, useState} from "react";
import {getFormById} from "../api/forms.service";
import {useTranslation} from "react-i18next";
import {Button, Container, Form, Spinner} from "react-bootstrap";
import "./Forms.css";
import {renderFormGroups} from "./RenderFormGroups";
import {convertFilesToBase64} from "../utils/fileUtils";
import {formFieldValidation} from "../utils/formUtils";
import {
    getAwaitingFormById,
    getAwaitingForms, getFilledFormInstanceById,
    getPreviousFilledForms,
    sendFilledForm
} from "../api/formsInstances.service";
import {useUser} from "../contexts/UserContext";
import {getFilledProcessesAndFormsInstances, getFilledProcessInstance} from "../api/processesInstances.service";

export default function Forms() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { t } = useTranslation();
    const { user } = useUser();

    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get("type");
    const processInstanceId = searchParams.get("processInstanceId");

    const [form, setForm] = useState(location.state?.form || null);
    const [prevForms, setPrevForms] = useState([]);
    const [formValues, setFormValues] = useState([]);
    const [loading, setLoading] = useState(!location.state?.form);
    const [error, setError] = useState(null);
    const [openPrevForms, setOpenPrevForms] = useState({});
    const [filledForms, setFilledForms] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (type === "instance") {
                    const prevRes = await getPreviousFilledForms({processInstanceId: processInstanceId, formId: form.formId});
                    setPrevForms(prevRes.data || []);
                } else if(type === "filled") {
                    if(!processInstanceId) {
                        const res = await getFilledProcessInstance(id);
                        setPrevForms([res.data.initializedProcessInstance]);
                    } else {
                        const res = await getFilledFormInstanceById(id);
                        setPrevForms([res.data]);
                    }
                } else {
                    setLoading(true);
                    const res = await getFormById(id);
                    setForm(res.data);
                }
            } catch (e) {
                console.error("Error while getting the form:", e);
                setError(t("formNotFound"));
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchData();
    }, [id, t, type]);

    const handleChange = (groupType, fieldKey, value) => {
        setFormValues(prev => {
            const updated = prev.length ? [...prev] : form.formData.map(g => ({ ...g }));

            return updated.map(group => {
                if (group.type !== groupType) return group;

                const newField = {
                    ...group[fieldKey],
                    value
                };

                if (formFieldValidation(fieldKey, value) === false) {
                    newField.error = "invalid";
                } else if(newField.error) {
                    delete newField.error;
                }

                return {
                    ...group,
                    [fieldKey]: newField
                };
            });
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        convertFilesToBase64(formValues, (finalValues) => {

            const body = {
                "formData" : finalValues,
                "formId": form.id,
                "userId": user.id
            }
            if(type === "instance") {
                body["processInstanceId"] = form.processInstanceId;
            }
            sendFilledForm(body).then((response) => {
                navigate("/", { state: { refresh: true } });
            });
        });

    };

    const togglePrevForm = (index) => {
        setOpenPrevForms(prev => ({
            ...prev,
            [index]: !prev[index],
        }));
    };

    if (loading) {
        return (
            <Container className="form-container">
                <Spinner animation="border" variant="primary" />
                <p className="loading-text">{t("loading")}...</p>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="form-container">
                <p>{error}</p>
                <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                    ← {t("back")}
                </Button>
            </Container>
        );
    }

    if (!form) {
        return (
            <Container className="form-container">
                <p>{t("formNotFound")}</p>
                <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                    ← {t("back")}
                </Button>
            </Container>
        );
    }

    console.log(form);

    return (
        <Container className="forms-page">
            <div className="header-row">
                <Button variant="light" onClick={() => navigate(-1)} className="back-button">
                    ← {t("back")}
                </Button>
                <div className="form-header-text">
                    {type === "instance" || type === "start" && (
                        <h2 className="form-title">{form.name}</h2>
                    )}
                    {type === "filled" && !processInstanceId && (
                        <h2 className="form-title">{form.name}</h2>
                    )}
                    {type === "filled" && processInstanceId && (
                        <h2 className="form-title">{form.formName}</h2>
                    )}
                    {type === "instance" || (type === "filled" && processInstanceId) &&
                        (<h4 className="requestor-text">{t("requestor")}: {form.initialUserName}</h4>)
                    }
                </div>
            </div>

            {(type === "filled" && !processInstanceId) && (
                <div className="prev-forms-section">

                    {form.formsInstances
                        .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))
                        .map((pf, idx) => (
                        <>
                            <div className="table-wrapper">
                                <Form className="prev-form">
                                    {renderFormGroups(pf, [], () => {}, t, true)}
                                </Form>
                            </div>
                        </>
                    ))}
                </div>
            )}

            {(type === "filled" && processInstanceId) && (
                <div className="prev-forms-section">
                    <>
                        <div className="table-wrapper">
                            <Form className="prev-form">
                                {renderFormGroups(form, [], () => {}, t, true)}
                            </Form>
                        </div>
                    </>
                </div>
            )}

            {(type === "instance" && prevForms.length > 0) && (
                <div className="prev-forms-section">

                    {prevForms.map((pf, idx) => (
                        <div key={idx} className="main-section-form">
                            <h2
                                className="section-header"
                                onClick={() => togglePrevForm(idx)}
                            >
                                {pf.formName}
                                <span className="arrow">
                        {openPrevForms[idx] ? "▲" : "▼"}
                    </span>
                            </h2>

                            {openPrevForms[idx] && (
                                <div className="table-wrapper">
                                    <Form className="prev-form">
                                        {renderFormGroups(pf, [], () => {}, t, true)}
                                    </Form>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {(type === "instance" || type === "start") && (
                <Form onSubmit={handleSubmit}>
                    {renderFormGroups(form, formValues, handleChange, t)}

                    <div className="form-submit-wrapper">
                        <Button
                            variant="primary"
                            type="submit"
                            className="form-submit-button"
                        >
                            {t("submit")}
                        </Button>
                    </div>
                </Form>
            )}
        </Container>
    );
}
