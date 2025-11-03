const authWrapper = ({
                         excludedRoutes = [],
                         internalSecret = null,
                     }) => {
    return async (req, res, next) => {
        const internalKey = req.headers['x-service-auth'];
        const isInternalRequest = (internalSecret && internalKey === internalSecret);
        const path = req.path;
        const method = req.method.toLowerCase();

        const isExcluded = excludedRoutes.some(
            route =>
                (route.path instanceof RegExp
                    ? route.path.test(path)
                    : route.path === path) &&
                (!route.method || route.method.toLowerCase() === method)
        );

        if (isExcluded) return next();

        logger.debug(isInternalRequest);
        logger.debug(internalKey);
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
