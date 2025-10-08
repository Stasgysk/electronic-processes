/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();

/* GET user info. */
router.get('/me', async function (req, res, next) {
    try {
        const user = await postgres.Users.entity({ id: req.userId });
        if (!user) return res.status(404).json(resBuilder.fail('User not found'));

        return res.status(200).json(resBuilder.success(user));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.fail('Internal server error'));
    }
});

/* GET users roles */
router.get('/roles', async function (req, res, next) {
    try {
        const user = await postgres.Users.entity({ id: req.userId });
        if (!user) return res.status(404).json(resBuilder.fail('User not found'));

        return res.status(200).json(resBuilder.success(user));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.fail('Internal server error'));
    }
});

/* PUT update user */
/* Now only user group id update is available */
router.put('/', async function (req, res, next) {
    try {
        const userGroupId = req.body.userGroupId;

        const userGroup = await postgres.UsersGroups.entity({ id: userGroupId });
        if (!userGroup) return res.status(404).json(resBuilder.fail('User group not found'));

        const user = await postgres.Users.entity({ id: req.userId });
        user.userGroupId = userGroupId;
        await user.save();

        return res.status(200).json(resBuilder.success(user));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.fail('Internal server error'));
    }
});

module.exports = router;
