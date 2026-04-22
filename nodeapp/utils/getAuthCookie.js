const axios = require("axios");

// cached cookie value and when it expires
let authCookie = null;
let cookieExpires = 0;

// logs in to n8n and returns the session cookie.
// the cookie is cached in memory and reused until it's about to expire,
// so we don't make a new login request on every API call.
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

    // grab just the name=value part, drop the rest of the cookie attributes
    authCookie = cookie.split(';')[0];

    // parse the Expires attribute so we know when to refresh.
    // if there's no Expires, assume 5 minutes as a safe fallback.
    // subtract 5 seconds to avoid using a cookie that's just about to expire.
    const expiresPart = cookie.match(/Expires=([^;]+)/);
    if (expiresPart) {
        cookieExpires = new Date(expiresPart[1]).getTime() - 5000;
    } else {
        cookieExpires = now + 5 * 60 * 1000;
    }

    return authCookie;
}

module.exports = { getAuthCookie };
