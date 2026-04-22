// Shared axios instance used by all API service files.
// baseURL is set from REACT_APP_NODE_JS_URL so the dev/prod backend URL
// can be switched with an env variable without touching service files.
import axios from "axios";

const gsAxios = axios.create({
    baseURL: process.env.REACT_APP_NODE_JS_URL,
});

export default gsAxios;