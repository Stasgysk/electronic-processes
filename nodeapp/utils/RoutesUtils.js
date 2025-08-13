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
        length = false;
    }
    if(!ifStringIsNumber(offset)) {
        offset = 0;
    }

    return {eager, length, offset};
}

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

function ifStringIsBool(bool) {
    return bool === true || bool === "true";
}

function ifStringIsNumber(string) {
    return !isNaN(Number(string));
}

module.exports = {
    getDefaultRequestParams,
}