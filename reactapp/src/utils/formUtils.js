// Per-field validation run on every change in handleChange (FormsPage / Forms).
// Returns true if the value is valid, false if it should be flagged with an error.
//
// Only fields with special rules need a case here — everything else returns true
// (no validation) by default.  Currently only 'email' is special-cased.
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