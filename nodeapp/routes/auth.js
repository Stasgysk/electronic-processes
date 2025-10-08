/* global logger */
/* global resBuilder */

let express = require('express');
const routesUtils = require("../utils/RoutesUtils");
const {getRoleByEmail} = require("../utils/UserUtils");
let router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { code } = req.body;
        const userAgent = req.headers['user-agent'];
        const ip = req.ip;

        if (!code) return res.status(400).json(resBuilder.fail('Authorization code is required'));

        const tokenResponse = await fetch(process.env.TUKE_SSO2_TOKEN_URL, {
            method: 'POST',
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.TUKE_SSO2_REDIRECT_URL,
                client_id: process.env.TUKE_SSO2_CLIENT_ID,
                client_secret: process.env.TUKE_SSO2_SECRET,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).then(r => r.json());

        if (!tokenResponse.access_token) {
            return res.status(401).json(resBuilder.fail('Unauthorized'));
        }

        const userInfo = await fetch(process.env.TUKE_SSO2_USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        }).then(r => r.json());

        let user = await postgres.Users.entity({ email: userInfo.email });
        if (!user) {
            const userGroupId = await getRoleByEmail(userInfo.email);
            user = await postgres.Users.create({
                userGroupId: userGroupId,
                email: userInfo.email,
                name: userInfo['full_name']
            });
        }

        const expiresInSeconds = tokenResponse.expires_in;
        const expiresAt = Date.now() + (expiresInSeconds * 1000);
        const csrfSecret = Math.random().toString(36).substring(2, 15);

        await userUtils.removeExpiredSessions(user.id);

        const session = await postgres.UsersSessions.create({
            userId: user.id,
            refreshToken: tokenResponse.refresh_token,
            csrfSecret: csrfSecret,
            userAgent: userAgent,
            ipPrefix: ip,
            expiresAt: expiresAt
        });

        res.cookie('session_id', session.sessionId, { httpOnly: true, secure: true, sameSite: 'none' });
        return res.status(200).json(resBuilder.success({ accessToken: tokenResponse.access_token, csrfToken: session.csrfSecret, expiresIn: expiresInSeconds }));
    } catch (e) {
        logger.error(e);
        logger.error(e.stack);
        return res.status(500).json(resBuilder.fail('Internal server error'));
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const sessionId = req.cookies.session_id;
        const csrfToken = req.headers['x-csrf-token'];
        const userAgent = req.headers['user-agent'];
        const ip = req.ip;

        if(!sessionId || !csrfToken) {
            return res.status(401).json(resBuilder.fail('Unauthorized'));
        }

        await userUtils.removeExpiredSessionsBySessionId(sessionId);

        const session = await postgres.UsersSessions.entity({ sessionId: sessionId });
        if (!session) return res.status(401).json(resBuilder.fail('Unauthorized'));

        if(userUtils.isSessionExpired(session)) return res.status(401).json(resBuilder.fail('Unauthorized'));

        if (csrfToken !== session.csrfSecret) {
            return res.status(401).json(resBuilder.fail('Unauthorized'));
        }

        if (session.userAgent !== userAgent) {
            return res.status(401).json(resBuilder.fail('Unauthorized'));
        }

        if (session.ipPrefix !== ip) {
            return res.status(401).json(resBuilder.fail('Unauthorized'));
        }

        const tokenResponse = await fetch(process.env.TUKE_SSO2_TOKEN_URL, {
            method: 'POST',
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: session.refreshToken,
                client_id: process.env.TUKE_SSO2_CLIENT_ID,
                client_secret: process.env.TUKE_SSO2_SECRET,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).then(r => r.json());

        if (!tokenResponse.access_token) {
            return res.status(401).json(resBuilder.fail('Unauthorized'));
        }

        logger.debug(tokenResponse)

        session.refreshToken = tokenResponse.refresh_token;
        session.expiresAt = Date.now() + (tokenResponse['refresh_expires_in'] * 1000);
        await session.save();

        return res.status(200).json(resBuilder.success({ accessToken: tokenResponse.access_token }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.fail('Internal server error'));
    }
});

router.post('/logout', async (req, res) => {
    const sessionId = req.cookies.session_id;

    try {
        if(sessionId) {
            const session = await postgres.UsersSessions.entity({ sessionId: sessionId });

            if (session) {
                await session.destroy();
                await userUtils.removeExpiredSessions(session.userId);
            }
        }

        res.clearCookie('session_id');
        return res.status(200).json(resBuilder.success('Logged out successfully'));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.fail('Internal server error'));
    }
});

module.exports = router;
