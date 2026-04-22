// Reads common query/body params used across all list endpoints: eager, length, offset, lan.
// Validates and normalizes them so routes don't have to repeat the same parsing logic.
function getDefaultRequestParams(req) {
    let eager = getEager(req);
    let length = getLength(req);
    let offset = getOffset(req);
    let lan = getLanguage(req);

    ({eager, length, offset} = validateEntitiesParams(eager, length, offset))
    return {eager, length, offset, lan};
}

function validateEntitiesParams(eager, length, offset) {
    eager = ifStringIsBool(eager);
    if(!ifStringIsNumber(length)) {
        length = false; // false means no limit
    }
    if(!ifStringIsNumber(offset)) {
        offset = 0;
    }

    return {eager, length, offset};
}

// looks for "eager" in query string first, then falls back to request body
function getEager(req) {
    let {eager} = req.query;

    if(!eager) {
        eager = req.body?.eager;
    }

    eager = ifStringIsBool(eager);

    return eager;
}

function getLength(req) {
    let {length} = req.query;

    if(!length) {
        length = req.body?.length;
    }

    if(!ifStringIsNumber(length)) {
        length = false;
    }

    return length;
}

function getOffset(req) {
    let {offset} = req.query;

    if(!offset) {
        offset = req.body?.offset;
    }

    if(!ifStringIsNumber(offset)) {
        offset = 0;
    }

    return offset;
}

// defaults to "en" if the requested language is not in the supported list
function getLanguage(req) {
    let {lan} = req.query;

    if(!lan) {
        lan = req.body?.lan;
    }

    if(!lan || !config.translate.supported_languages.includes(lan)) {
        return "en";
    }

    return lan;
}

// query params arrive as strings, so "true"/"false" need to be converted
function ifStringIsBool(bool) {
    return bool === true || bool === "true";
}

function ifStringIsNumber(string) {
    return !isNaN(Number(string));
}

module.exports = {
    getDefaultRequestParams,
}
