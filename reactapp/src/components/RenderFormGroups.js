// Renders a form definition (form.formData array) as React Bootstrap form fields.
//
// Used in three places:
//   1. FormsPage (type=start / type=instance)  →  editable, readOnly=false
//   2. FormsPage (type=instance, previous steps)  →  read-only, readOnly=true
//   3. FormsPage (type=filled)  →  read-only, readOnly=true
//
// form.formData is an array of group objects.  Each group has:
//   - type       →  "personal" | "contact" | "address" | "custom"  (used as React key)
//   - groupName  →  display label for the group header
//   - [fieldKey] →  { name, type, value } for each field in the group
//
// formValues mirrors the same shape but holds the live user input while editing.
// handleChange(groupType, fieldKey, value) is called on every input event.
//
// Field types supported:
//   string / number / date  →  <Form.Control type=...>
//   boolean                 →  <Form.Select> with yes/no options
//   checkbox                →  <Form.Check>
//   file                    →  file picker (editable) or download button (read-only)

import {Card, Row, Col, Form, Button} from "react-bootstrap";
export function renderFormGroups(form, formValues, handleChange, t, readOnly = false) {

    // empty formData means the step hasn't been submitted yet
    // (e.g. an approver step that's still INACTIVE/WAITING)
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
        // find the matching live-value group so controlled inputs get the current typed value
        const groupValue = formValues.find(g => g.type === group.type);

        return (
            <Card className="form-card" key={groupIdx}>
                <Card.Body>
                    <h5 className="form-group-title">{group.groupName}</h5>
                    <Row className="justify-content-center">
                        {Object.entries(group).map(([key, field]) => {
                            // skip metadata keys — they're not renderable fields
                            if (["type", "groupName"].includes(key)) return null;

                            const fieldId = `${group.type}-${key}`;

                            console.log(field);
                            return (
                                <Col md={6} lg={4} key={fieldId} className="mb-3">
                                    <Form.Group controlId={fieldId}>

                                        {/* text / number / date fields share the same input component */}
                                        {["string", "number", "date"].includes(field.type) && (
                                            <>
                                                <Form.Label>{field.name}</Form.Label>
                                                <Form.Control
                                                    type={field.type}
                                                    // prefer live value from formValues; fall back to
                                                    // the stored value (read-only mode) or empty string
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

                                        {/*
                                          boolean is rendered as a select (yes / no / blank).
                                          In read-only mode field.value already holds true/false,
                                          in edit mode groupValue holds the current selection.
                                          The select value must be a string, so booleans are
                                          stringified to "true"/"false" for the option values.
                                        */}
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
                                                        // convert the string back to a boolean before storing
                                                        handleChange(group.type, key, e.target.value === "true", "boolean")
                                                    }
                                                >
                                                    <option value="">{t('selectOption')}</option>
                                                    <option value="true">{t('yes')}</option>
                                                    <option value="false">{t('no')}</option>
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
                                                {/* editable: standard file picker; the File object is later
                                                    converted to base64 by convertFilesToBase64 on submit */}
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

                                                {/*
                                                  read-only: the stored value is a base64 string.
                                                  Decode it, wrap in a Blob, create an object URL,
                                                  trigger a download via a temporary <a>, then revoke
                                                  the URL to release memory.
                                                */}
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
