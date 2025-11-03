import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getFormById } from "../api/forms.service";
import { useTranslation } from "react-i18next";
import { Button, Form, Spinner, Container, Card, Row, Col } from "react-bootstrap";
import "./Forms.css";

export default function Forms() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { t } = useTranslation();

    const [form, setForm] = useState(location.state?.form || null);
    const [formValues, setFormValues] = useState({});
    const [loading, setLoading] = useState(!location.state?.form);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!form) {
            const fetchForm = async () => {
                try {
                    setLoading(true);
                    const res = await getFormById(id);
                    setForm(res.data);
                } catch (e) {
                    console.error("Error while getting the form:", e);
                    setError(t("formNotFound"));
                } finally {
                    setLoading(false);
                }
            };
            fetchForm();
        }
    }, [id, form, t]);

    const handleChange = (groupType, fieldKey, value) => {
        setFormValues((prev) => ({
            ...prev,
            [groupType]: {
                ...prev[groupType],
                [fieldKey]: value,
            },
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Submitted form values:", formValues);
        alert("Форма отправлена! Смотри console.log()");
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
                    <h2 className="form-title">{form.formName}</h2>
                </div>
            </div>

            <Form onSubmit={handleSubmit}>
                {form.formData.map((group, groupIdx) => (
                    <Card className="form-card" key={groupIdx}>
                        <Card.Body>
                            <h5 className="form-group-title">{group.groupName}</h5>
                            <Row>
                                {Object.entries(group).map(([key, field]) => {
                                    if (["type", "groupName"].includes(key)) return null;

                                    const fieldId = `${group.type}-${key}`;
                                    const fieldType =
                                        field.type === "string"
                                            ? "text"
                                            : field.type === "number"
                                                ? "number"
                                                : field.type === "date"
                                                    ? "date"
                                                    : field.type === "boolean"
                                                        ? "checkbox"
                                                        : "text";

                                    return (
                                        <Col md={6} lg={4} key={fieldId} className="mb-3">
                                            <Form.Group controlId={fieldId}>
                                                {fieldType === "checkbox" ? (
                                                    <Form.Check
                                                        type="checkbox"
                                                        label={field.name}
                                                        checked={formValues[group.type]?.[key] || false}
                                                        onChange={(e) =>
                                                            handleChange(
                                                                group.type,
                                                                key,
                                                                e.target.checked
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <>
                                                        <Form.Label className="field-label">
                                                            {field.name}
                                                        </Form.Label>
                                                        <Form.Control
                                                            type={fieldType}
                                                            value={formValues[group.type]?.[key] || ""}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    group.type,
                                                                    key,
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="field-input"
                                                        />
                                                    </>
                                                )}
                                            </Form.Group>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </Card.Body>
                    </Card>
                ))}

                <div className="form-submit-wrapper">
                    <Button
                        variant="primary"
                        type="submit"
                        className="form-submit-button"
                    >
                        {t("submit") || "Отправить"}
                    </Button>
                </div>
            </Form>
        </Container>
    );
}
