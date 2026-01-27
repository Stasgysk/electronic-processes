function formFieldValidation(fieldKey, value) {
    switch (fieldKey) {
        case 'email':
            const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return strictEmailRegex.test(value);
        default:
            return true;
    }
}

module.exports = {
    formFieldValidation,
}