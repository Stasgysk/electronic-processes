/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();
const { reassignOrgRolesByEmailAndUnit } = require('../utils/UserUtils');

/* GET user info. */
router.get('/me', async function (req, res, next) {
    try {
        const user = await postgres.Users.entity({ id: req.userId }, true);
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

// called from the onboarding modal; user selects their group and org unit
router.put('/', async function (req, res, next) {
    try {
        const { userGroupId, orgUnitId } = req.body;
        const user = await postgres.Users.entity({ id: req.userId });
        if (!user) return res.status(404).json(resBuilder.fail('User not found'));

        if (userGroupId !== undefined) {
            const userGroup = await postgres.UsersGroups.entity({ id: userGroupId });
            if (!userGroup) return res.status(404).json(resBuilder.fail('User group not found'));
            // promoting to ADMIN requires a secret code configured in env
            if (userGroup.name === 'ADMIN') {
                const adminCode = (req.body.adminCode || '').trim();
                const envCode = (process.env.ADMIN_CODE || '').trim();
                if (!envCode) {
                    return res.status(403).json(resBuilder.fail('Admin promotion is disabled (ADMIN_CODE not set)'));
                }
                if (!adminCode || adminCode !== envCode) {
                    return res.status(403).json(resBuilder.fail('Invalid admin code'));
                }
            }
            user.userGroupId = userGroupId;
        }

        // null orgUnitId is valid (user can clear their org unit)
        const newOrgUnitId = orgUnitId !== undefined ? (orgUnitId ? parseInt(orgUnitId) : null) : undefined;
        if (newOrgUnitId !== undefined) {
            user.orgUnitId = newOrgUnitId;
        }

        await user.save();

        // when the org unit changes, recalculate pattern-based role assignments in the background
        if (newOrgUnitId) {
            reassignOrgRolesByEmailAndUnit(user.id, user.email, newOrgUnitId).catch(e => logger.error(e));
        }

        const updatedUser = await postgres.Users.entity({ id: req.userId }, true);
        return res.status(200).json(resBuilder.success(updatedUser));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.fail('Internal server error'));
    }
});

module.exports = router;
