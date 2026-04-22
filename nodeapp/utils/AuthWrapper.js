// Middleware that protects all routes. Two ways to get through:
// 1. Internal service call with a shared secret in the x-service-auth header (used by n8n callbacks)
// 2. Normal user session via session_id cookie
const authWrapper = ({
                         excludedRoutes = [],
                         internalSecret = null,
                     }) => {
    return async (req, res, next) => {
        const internalKey = req.headers['x-service-auth'];
        const isInternalRequest = (internalSecret && internalKey === internalSecret);
        const path = req.path;
        const method = req.method.toLowerCase();

        // check if this route+method combo is on the excluded list (e.g. /auth/login)
        const isExcluded = excludedRoutes.some(
            route =>
                (route.path instanceof RegExp
                    ? route.path.test(path)
                    : route.path === path) &&
                (!route.method || route.method.toLowerCase() === method)
        );

        if (isExcluded) return next();

        // n8n and other internal services use the shared secret instead of a user session
        if (isInternalRequest) {
            req.authType = 'internal';
            return next();
        }

        const sessionId = req.cookies.session_id;
        if (!sessionId) {
            return res.status(401).json(resBuilder.fail('Unauthorized'));
        }

        try {
            const session = await postgres.UsersSessions.entity({sessionId});

            if (!session) {
                return res.status(401).json(resBuilder.fail('Unauthorized'));
            }

            if (userUtils.isSessionExpired(session)) {
                return res.status(401).json(resBuilder.fail('Session expired'));
            }

            // attach user id to the request so route handlers know who is calling
            req.userId = session.userId;
            req.authType = 'session';
            next();
        } catch (error) {
            console.error('Auth check failed:', error);
            res.status(500).json(resBuilder.fail('Something went wrong'));
        }
    };
};

module.exports = authWrapper;
