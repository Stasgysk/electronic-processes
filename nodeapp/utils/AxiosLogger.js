let axios = require('axios');

axios.interceptors.request.use((config) => {
    const msg = `${config.url} - "${config.method?.toUpperCase()}", DATA: ${JSON.stringify(config.data)}`;
    logger.info(msg);
    return config;
}, (error) => {
    const msg = `REQUEST ERROR: ${error.message}`;
    logger.error(msg);
    return Promise.reject(error);
});

axios.interceptors.response.use((response) => {
    const msg = `RESPONSE: ${response.status} ${response.config.url}`;
    logger.info(msg)
    const debugMsg = `DATA: ${JSON.stringify(response.data)}`;
    logger.debug(debugMsg);
    return response;
}, (error) => {
    const msg = error.response
        ? `RESPONSE ERROR: ${error.response.status} ${error.config?.url} DATA: ${JSON.stringify(error.response.data)}`
        : `NETWORK ERROR: ${error.message}`;
    logger.error(msg);
    return Promise.reject(error);
});

module.exports = axios;