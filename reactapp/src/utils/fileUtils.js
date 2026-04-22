// Converts File objects in formValues to base64 strings before the form is submitted.
//
// Why base64: form data is stored as a JSON column in the DB. File objects can't be
// serialised to JSON, so they're read with FileReader and replaced with a plain object:
//   { name, fileName, mimeType, type: "file", value: "<base64 string>" }
//
// The base64 string has the "data:<mime>;base64," prefix stripped (split(",")[1])
// so only the raw encoded bytes are stored — the mimeType field carries the prefix info.

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

// walks all groups in formValues, converts every field whose value is a File instance,
// then calls callback with the updated array once all conversions are done
function convertFilesToBase64(formValues, callback) {
    const updated = formValues.map(group => ({ ...group }));
    const promises = [];

    updated.forEach(group => {
        Object.entries(group).forEach(([fieldKey, fieldData]) => {
            if (fieldKey === "type") return; // metadata key, not a field

            if (fieldData.type === "file" && fieldData.value instanceof File) {
                const promise = fileToBase64(fieldData.value).then(base64 => {
                    group[fieldKey] = {
                        name: fieldData.name,
                        fileName: fieldData.value.name,
                        mimeType: fieldData.value.type,
                        type: "file",
                        value: base64.split(",")[1]  // strip the data URI prefix
                    };
                });

                promises.push(promise);
            }
        });
    });

    Promise.all(promises).then(() => callback(updated));
}

module.exports = {
    convertFilesToBase64,
}
