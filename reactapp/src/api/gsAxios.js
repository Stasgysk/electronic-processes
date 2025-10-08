import axios from "axios";

const gsAxios = axios.create({
    baseURL: process.env.REACT_APP_NODE_JS_URL,
});

export default gsAxios;