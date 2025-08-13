class ResponseBuilder {
    constructor() {

    }

    #message(data, status) {
        if(!data) {
            data = {}
        }
        return {
            "status": status,
            "data": data
        }
    }

    success(data) {
        return this.#message(data, "success");
    }

    error(data) {
        return this.#message(data, "error");
    }

    fail(data) {
        return this.#message(data, "fail");
    }
}

module.exports = new ResponseBuilder();