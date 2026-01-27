// src/components/RenderFormGroups.js
import {Card, Row, Col, Form, Button} from "react-bootstrap";
export function renderFormGroups(form, formValues, handleChange, t, readOnly = false) {
    if (Object.keys(form.formData).length === 0) {
        return (
            <Card className="form-card" key={form.id}>
                <Card.Body>
                    <h5 className="form-group-title">{form.formName}</h5>
                    <Row className="justify-content-center">
                        <>
                            <h4>{t('waitingForResponse')}</h4>
                        </>
                    </Row>
                </Card.Body>
            </Card>
        );
    }
    return form.formData.map((group, groupIdx) => {
        const groupValue = formValues.find(g => g.type === group.type);

        return (
            <Card className="form-card" key={groupIdx}>
                <Card.Body>
                    <h5 className="form-group-title">{group.groupName}</h5>
                    <Row className="justify-content-center">
                        {Object.entries(group).map(([key, field]) => {
                            if (["type", "groupName"].includes(key)) return null;

                            const fieldId = `${group.type}-${key}`;

                            console.log(field);
                            return (
                                <Col md={6} lg={4} key={fieldId} className="mb-3">
                                    <Form.Group controlId={fieldId}>

                                        {["string", "number", "date"].includes(field.type) && (
                                            <>
                                                <Form.Label>{field.name}</Form.Label>
                                                <Form.Control
                                                    type={field.type}
                                                    value={groupValue?.[key]?.value ?? field.value ?? ""}
                                                    disabled={readOnly}
                                                    isInvalid={!!groupValue?.[key]?.error}
                                                    onChange={(e) =>
                                                        handleChange(group.type, key, e.target.value, field.type)
                                                    }
                                                />
                                                <Form.Control.Feedback type="invalid">
                                                    {groupValue?.[key]?.error ? t("formFieldInvalid") : null}
                                                </Form.Control.Feedback>
                                            </>
                                        )}

                                        {field.type === "boolean" && (
                                            <>
                                                <Form.Label>{field.name}</Form.Label>
                                                <Form.Select
                                                    value={
                                                        field.value === true || field.value === false ? field.value :
                                                        groupValue?.[key]?.value === true
                                                            ? "true"
                                                            : groupValue?.[key]?.value === false
                                                                ? "false"
                                                                : ""
                                                    }
                                                    disabled={readOnly}
                                                    onChange={(e) =>
                                                        handleChange(group.type, key, e.target.value === "true", "boolean")
                                                    }
                                                >
                                                    <option value="">-- Vyberte --</option>
                                                    <option value="true">Ano</option>
                                                    <option value="false">Nie</option>
                                                </Form.Select>
                                            </>
                                        )}

                                        {field.type === "checkbox" && (
                                            <>
                                                <Form.Label>{field.name}</Form.Label>
                                                <div className="checkbox-wrapper">
                                                    <Form.Check
                                                        type="checkbox"
                                                        checked={groupValue?.[key]?.value ?? field.value ?? false}
                                                        disabled={readOnly}
                                                        onChange={(e) =>
                                                            handleChange(group.type, key, e.target.checked, "checkbox")
                                                        }
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {field.type === "file" && (
                                            <>
                                                {!readOnly && (
                                                    <>
                                                        <Form.Label>{field.name}</Form.Label>
                                                            <Form.Control
                                                                type="file"
                                                                isInvalid={!!groupValue?.[key]?.error}
                                                                disabled={readOnly}
                                                                onChange={(e) =>
                                                                    handleChange(group.type, key, e.target.files?.[0] || null, "file")
                                                            }
                                                            />
                                                        <Form.Control.Feedback type="invalid">
                                                            {groupValue?.[key]?.error ? t("formFieldInvalid") : null}
                                                        </Form.Control.Feedback>
                                                    </>
                                                )}

                                                {readOnly && field.value && (
                                                    <>
                                                        <Form.Label>{field.name}</Form.Label>

                                                        <Button
                                                            className="form-control"
                                                            variant="outline-primary"
                                                            size="sm"
                                                            onClick={() => {
                                                                const base64 = field.value;
                                                                const byteCharacters = atob(base64);
                                                                const byteNumbers = new Array(byteCharacters.length);
                                                                for (let i = 0; i < byteCharacters.length; i++) {
                                                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                                }
                                                                const byteArray = new Uint8Array(byteNumbers);
                                                                const blob = new Blob([byteArray], { type: field.mimeType });
                                                                const url = URL.createObjectURL(blob);

                                                                const link = document.createElement("a");
                                                                link.href = url;
                                                                link.download = field.fileName || "file";
                                                                link.click();
                                                                URL.revokeObjectURL(url);
                                                            }}
                                                        >
                                                            {t("download")}
                                                        </Button>
                                                    </>
                                                )}

                                            </>
                                        )}

                                    </Form.Group>
                                </Col>
                            );
                        })}
                    </Row>
                </Card.Body>
            </Card>
        );
    });
}
