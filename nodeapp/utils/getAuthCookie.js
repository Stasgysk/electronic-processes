const axios = require("axios");

let authCookie = null;
let cookieExpires = 0;

async function getAuthCookie() {
    const now = Date.now();
    if (authCookie && now < cookieExpires) {
        return authCookie;
    }

    const r = await axios.post(
        `${process.env.N8N_BASE_URL}rest/login`,
        {
            emailOrLdapLoginId: process.env.N8N_API_USER_EMAIL,
            password: process.env.N8N_API_USER_PASSWORD,
        },
        { withCredentials: true }
    );

    const cookieHeader = r.headers['set-cookie'];
    const cookie = cookieHeader.find(c => c.startsWith('n8n-auth='));
    if (!cookie) throw new Error('Auth cookie not found!');

    authCookie = cookie.split(';')[0];

    const expiresPart = cookie.match(/Expires=([^;]+)/);
    if (expiresPart) {
        cookieExpires = new Date(expiresPart[1]).getTime() - 5000;
    } else {
        cookieExpires = now + 5 * 60 * 1000;
    }

    return authCookie;
}

module.exports = { getAuthCookie };
