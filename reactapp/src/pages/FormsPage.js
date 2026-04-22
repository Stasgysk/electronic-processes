// Single page used for all form interactions. The ?type= query param controls behaviour:
//
//   type="start"
//     The user is initiating a brand new process. The form definition is fetched by
//     form id. On submit a new ProcessInstance + FormInstance is created server-side.
//
//   type="instance"
//     The current user is an approver for an ongoing process. The form that was already
//     filled by the initiator (and any intermediate approvers) is shown read-only above,
//     and the current user's form is shown below for editing.
//
//   type="filled"
//     Read-only historical view. Two sub-cases:
//       - no processInstanceId: viewing a full process the user started (shows all steps)
//       - with processInstanceId:  viewing a single form instance the user filled as approver

import {useLocation, useNavigate, useParams} from "react-router-dom";
import {useEffect, useState} from "react";
import {getFormById} from "../api/forms.service";
import {useTranslation} from "react-i18next";
import {Button, Container, Form, Spinner} from "react-bootstrap";
import "./FormsPage.css";
import {renderFormGroups} from "../components/RenderFormGroups";
import {convertFilesToBase64} from "../utils/fileUtils";
import {formFieldValidation} from "../utils/formUtils";
import {
    getFilledFormInstanceById,
    getPreviousFilledForms,
    sendFilledForm
} from "../api/formsInstances.service";
import {useUser} from "../contexts/UserContext";
import {getFilledProcessInstance} from "../api/processesInstances.service";

export default function FormsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();        // form id (or process instance id for "filled" view)
    const { t } = useTranslation();
    const { user } = useUser();

    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get("type");
    const processInstanceId = searchParams.get("processInstanceId");

    // form data passed via navigate state avoids an extra fetch when navigating from the list
    const [form, setForm] = useState(location.state?.form || null);
    // previously submitted steps shown read-only above the current form (instance and filled views)
    const [prevForms, setPrevForms] = useState([]);
    // live values the user is currently typing — keyed by group type then field key
    const [formValues, setFormValues] = useState([]);
    const [loading, setLoading] = useState(!location.state?.form);
    const [error, setError] = useState(null);
    // tracks which prev-form accordions are open (index → boolean)
    const [openPrevForms, setOpenPrevForms] = useState({});
    const [filledForms, setFilledForms] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (type === "instance") {
                    // fetch all previously filled steps for this process instance so the approver
                    // can see what the initiator (and earlier approvers) submitted
                    const prevRes = await getPreviousFilledForms({processInstanceId: processInstanceId, formId: form.formId});
                    setPrevForms(prevRes.data || []);
                } else if(type === "filled") {
                    if(!processInstanceId) {
                        // the user started this process — fetch the full process instance with all steps
                        const res = await getFilledProcessInstance(id);
                        setPrevForms([res.data.initializedProcessInstance]);
                    } else {
                        // the user was an approver — fetch only their single form instance
                        const res = await getFilledFormInstanceById(id);
                        setPrevForms([res.data]);
                    }
                } else {
                    // type="start": need to fetch the form definition (not passed via state)
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

    // updates a single field inside formValues; initialises the whole array from the form
    // definition on the very first keystroke so every group object exists before we mutate it
    const handleChange = (groupType, fieldKey, value) => {
        setFormValues(prev => {
            const updated = prev.length ? [...prev] : form.formData.map(g => ({ ...g }));

            return updated.map(group => {
                if (group.type !== groupType) return group;

                const newField = {
                    ...group[fieldKey],
                    value
                };

                // attach an error flag so the field highlights red; remove it once valid again
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

        // file fields hold File objects in state; convertFilesToBase64 replaces them
        // with { value, fileName, mimeType } objects the backend can store as JSON
        convertFilesToBase64(formValues, (finalValues) => {

            const body = {
                "formData" : finalValues,
                "formId": form.id,
                "userId": user.id
            }
            // approver submissions need the processInstanceId so the backend knows
            // which specific run of the process this belongs to
            if(type === "instance") {
                body["processInstanceId"] = form.processInstanceId;
            }
            sendFilledForm(body).then((response) => {
                // tell the home page to refetch its lists so the newly submitted
                // form shows up in "Filled" and disappears from "Awaiting"
                navigate("/", { state: { refresh: true } });
            });
        });

    };

    // toggle open/closed state of a previous-form accordion section
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

    return (
        <Container className="forms-page">
            <div className="header-row">
                <Button variant="light" onClick={() => navigate(-1)} className="back-button">
                    ← {t("back")}
                </Button>
                <div className="form-header-text">
                    {/*
                      Title display logic:
                        instance / start  →  form.name  (process name / form name combined by backend)
                        filled, no pid    →  form.name  (same)
                        filled, with pid  →  form.formName  (just the form step name)
                    */}
                    {type === "instance" || type === "start" && (
                        <h2 className="form-title">{form.name}</h2>
                    )}
                    {type === "filled" && !processInstanceId && (
                        <h2 className="form-title">{form.name}</h2>
                    )}
                    {type === "filled" && processInstanceId && (
                        <h2 className="form-title">{form.formName}</h2>
                    )}
                    {/* show who originally started the request — relevant for approvers */}
                    {type === "instance" || (type === "filled" && processInstanceId) &&
                        (<h4 className="requestor-text">{t("requestor")}: {form.initialUserName}</h4>)
                    }
                </div>
            </div>

            {/*
              "filled" without processInstanceId = the initiator is viewing their own process.
              The backend returns all form instances sorted by the time they were filled;
              we sort again client-side by updatedAt to be sure and render them all read-only.
            */}
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

            {/* "filled" with processInstanceId = an approver reviewing their own step */}
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

            {/*
              "instance" = an approver who needs to fill in their step.
              Previous steps are shown as collapsible sections above so they have
              context before deciding (e.g. seeing what the student requested).
            */}
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

            {/* the editable form — shown for both "start" (initiator) and "instance" (approver) */}
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
