/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();

/* GET current user's role assignments (with OrgRole + OrgUnit) */
router.get('/me', async function (req, res) {
    try {
        const { OrgRoles, OrgUnits } = postgres;
        const assignments = await postgres.UserOrgRoles.findAll({
            where: { userId: req.userId },
            include: [{
                model: OrgRoles,
                as: 'OrgRole',
                include: [{ model: OrgUnits, as: 'OrgUnit', attributes: ['id', 'name', 'type'] }],
            }],
            order: [['createdAt', 'DESC']],
        });
        return res.status(200).json(resBuilder.success(assignments));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting your roles"));
    }
});

/* GET assignments (filter by orgRoleId or userId) */
router.get('/', async function (req, res) {
    try {
        const { orgRoleId, userId } = req.query;
        const where = {};
        if (orgRoleId) where.orgRoleId = parseInt(orgRoleId);
        if (userId) where.userId = parseInt(userId);
        const assignments = await postgres.UserOrgRoles.entities(
            Object.keys(where).length ? where : null,
            true,
            [],
            500,
            0
        );
        return res.status(200).json(resBuilder.success(assignments));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting user org roles"));
    }
});

/* POST assign user to role (admin) */
router.post('/', async function (req, res) {
    try {
        const { userId, orgRoleId } = req.body;
        if (!userId || !orgRoleId) return res.status(400).json(resBuilder.fail("userId and orgRoleId are required"));

        const existing = await postgres.UserOrgRoles.entity({
            userId: parseInt(userId),
            orgRoleId: parseInt(orgRoleId),
        });
        if (existing) return res.status(200).json(resBuilder.success(existing));

        const assignment = await postgres.UserOrgRoles.create({
            userId: parseInt(userId),
            orgRoleId: parseInt(orgRoleId),
        });
        return res.status(200).json(resBuilder.success(assignment));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while assigning user to role"));
    }
});

/* POST self-join a role using access code */
router.post('/join', async function (req, res) {
    try {
        const { orgRoleId, accessCode } = req.body;
        if (!orgRoleId || !accessCode) return res.status(400).json(resBuilder.fail("orgRoleId and accessCode are required"));

        const role = await postgres.OrgRoles.entity({ id: parseInt(orgRoleId) });
        if (!role) return res.status(404).json(resBuilder.fail("Role not found"));
        if (!role.accessCode || role.accessCode !== accessCode) {
            return res.status(403).json(resBuilder.fail("Invalid access code"));
        }

        const existing = await postgres.UserOrgRoles.entity({ userId: req.userId, orgRoleId: parseInt(orgRoleId) });
        if (existing) return res.status(200).json(resBuilder.success(existing));

        const assignment = await postgres.UserOrgRoles.create({ userId: req.userId, orgRoleId: parseInt(orgRoleId) });
        return res.status(200).json(resBuilder.success(assignment));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while joining role"));
    }
});

/* DELETE assignment */
router.delete('/:id', async function (req, res) {
    try {
        const assignment = await postgres.UserOrgRoles.entity({ id: req.params.id });
        if (!assignment) return res.status(400).json(resBuilder.fail("Assignment not found"));
        await assignment.destroy();
        return res.status(200).json(resBuilder.success({ deleted: true }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while deleting assignment"));
    }
});

module.exports = router;
