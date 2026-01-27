function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}


function convertFilesToBase64(formValues, callback) {
    const updated = formValues.map(group => ({ ...group }));
    const promises = [];

    updated.forEach(group => {
        Object.entries(group).forEach(([fieldKey, fieldData]) => {
            if (fieldKey === "type") return;

            if (fieldData.type === "file" && fieldData.value instanceof File) {
                const promise = fileToBase64(fieldData.value).then(base64 => {
                    group[fieldKey] = {
                        name: fieldData.name,
                        fileName: fieldData.value.name,
                        mimeType: fieldData.value.type,
                        type: "file",
                        value: base64.split(",")[1]
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
