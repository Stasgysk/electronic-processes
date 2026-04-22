/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();

// converts the flat list of units into a nested tree by parent-child relationships
function buildTree(units) {
    const map = {};
    const roots = [];
    units.forEach(u => {
        map[u.id] = { ...u.dataValues, children: [] };
    });
    units.forEach(u => {
        if (u.parentId && map[u.parentId]) {
            map[u.parentId].children.push(map[u.id]);
        } else {
            roots.push(map[u.id]);
        }
    });
    return roots;
}

/* GET all org units as tree */
router.get('/', async function (req, res) {
    try {
        const units = await postgres.OrgUnits.entities(null, false, [], 2000, 0);
        const tree = buildTree(units);
        return res.status(200).json(resBuilder.success(tree));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting org units"));
    }
});

/* GET flat list of all org units */
router.get('/flat', async function (req, res) {
    try {
        const units = await postgres.OrgUnits.entities(null, false, [], 2000, 0);
        return res.status(200).json(resBuilder.success(units));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting org units flat"));
    }
});

/* GET all users with org units + roles (for admin panel) */
router.get('/users', async function (req, res) {
    try {
        const users = await postgres.Users.findAll({
            include: [
                {
                    model: postgres.UserWorkplaces,
                    as: 'UserWorkplaces',
                    required: false,
                    separate: true,
                    include: [{ model: postgres.OrgUnits, as: 'OrgUnit', required: false }],
                },
                {
                    model: postgres.UserOrgRoles,
                    as: 'UserOrgRoles',
                    required: false,
                    separate: true,
                    include: [{ model: postgres.OrgRoles, as: 'OrgRole', required: false }],
                },
            ],
            order: [['email', 'ASC']],
            limit: 200,
        });

        return res.status(200).json(resBuilder.success(users));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while fetching users"));
    }
});

/* GET search users by email (for assignment) */
router.get('/users/search', async function (req, res) {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json(resBuilder.fail("email query param is required"));

        const { Op } = require('sequelize');
        const users = await postgres.Users.findAll({
            where: { email: { [Op.iLike]: `%${email}%` } },
            limit: 10,
        });
        return res.status(200).json(resBuilder.success(users));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while searching users"));
    }
});

/* POST add workplace to a user (admin) */
router.post('/users/:userId/workplaces', async function (req, res) {
    try {
        const { orgUnitId } = req.body;
        if (!orgUnitId) return res.status(400).json(resBuilder.fail("orgUnitId is required"));

        const unit = await postgres.OrgUnits.entity({ id: parseInt(orgUnitId) });
        if (!unit) return res.status(400).json(resBuilder.fail("Org unit not found"));

        // return the existing record silently if the workplace is already assigned
        const existing = await postgres.UserWorkplaces.entity({ userId: parseInt(req.params.userId), orgUnitId: parseInt(orgUnitId) });
        if (existing) return res.status(200).json(resBuilder.success(existing));

        const wp = await postgres.UserWorkplaces.create({ userId: parseInt(req.params.userId), orgUnitId: parseInt(orgUnitId) });
        return res.status(200).json(resBuilder.success({ ...wp.dataValues, OrgUnit: unit }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while adding workplace"));
    }
});

/* DELETE remove workplace from a user (admin) */
router.delete('/users/:userId/workplaces/:wpId', async function (req, res) {
    try {
        const wp = await postgres.UserWorkplaces.entity({ id: parseInt(req.params.wpId), userId: parseInt(req.params.userId) });
        if (!wp) return res.status(400).json(resBuilder.fail("Workplace not found"));
        await wp.destroy();
        return res.status(200).json(resBuilder.success({ deleted: true }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while removing workplace"));
    }
});

/* PUT assign org unit to user (sets the primary unit, not a workplace) */
router.put('/users/:userId', async function (req, res) {
    try {
        const { orgUnitId } = req.body;
        const user = await postgres.Users.entity({ id: req.params.userId });
        if (!user) return res.status(400).json(resBuilder.fail("User not found"));
        user.orgUnitId = orgUnitId || null;
        await user.save();
        return res.status(200).json(resBuilder.success(user));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while updating user org unit"));
    }
});

/* POST create org unit */
router.post('/', async function (req, res) {
    try {
        const { name, type, parentId } = req.body;
        if (!name) return res.status(400).json(resBuilder.fail("name is required"));

        const unit = await postgres.OrgUnits.create({
            name,
            type: type || null,
            parentId: parentId ? parseInt(parentId) : null,
        });
        return res.status(200).json(resBuilder.success(unit));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while creating org unit"));
    }
});

/* PUT update org unit */
router.put('/:id', async function (req, res) {
    try {
        const unit = await postgres.OrgUnits.entity({ id: req.params.id });
        if (!unit) return res.status(400).json(resBuilder.fail("Org unit not found"));

        const { name, type, parentId, studentPickable, sortOrder } = req.body;
        if (name !== undefined) unit.name = name;
        if (type !== undefined) unit.type = type;
        if (parentId !== undefined) unit.parentId = parentId ? parseInt(parentId) : null;
        if (studentPickable !== undefined) unit.studentPickable = studentPickable;
        if (sortOrder !== undefined) unit.sortOrder = sortOrder !== null ? parseInt(sortOrder) : null;
        await unit.save();
        return res.status(200).json(resBuilder.success(unit));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while updating org unit"));
    }
});

// deep-clones a unit and all its children recursively.
// roles are copied but user assignments are not — the clone starts clean.
router.post('/:id/clone', async function (req, res) {
    try {
        const source = await postgres.OrgUnits.entity({ id: req.params.id });
        if (!source) return res.status(400).json(resBuilder.fail("Source org unit not found"));

        const { name, type, parentId } = req.body;
        if (!name) return res.status(400).json(resBuilder.fail("name is required"));

        const allUnits = await postgres.OrgUnits.entities(null, false, [], 2000, 0);
        const allRoles = await postgres.OrgRoles.entities(null, false, [], 2000, 0);

        const cloned = await cloneUnitRecursive(source.id, name, type !== undefined ? type : source.type, parentId !== undefined ? parentId : source.parentId, allUnits, allRoles);
        return res.status(200).json(resBuilder.success(cloned));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while cloning org unit"));
    }
});

async function cloneUnitRecursive(sourceId, name, type, parentId, allUnits, allRoles) {
    const newUnit = await postgres.OrgUnits.create({ name, type: type || null, parentId: parentId || null });

    // copy roles from the source unit to the new unit
    const sourceRoles = allRoles.filter(r => r.orgUnitId === sourceId);
    for (const role of sourceRoles) {
        await postgres.OrgRoles.create({
            name: role.name,
            orgUnitId: newUnit.id,
            emailPattern: role.emailPattern || null,
            accessCode: role.accessCode || null,
            isStudentRole: role.isStudentRole || false,
        });
    }

    // recurse into child units
    const children = allUnits.filter(u => u.parentId === sourceId);
    for (const child of children) {
        await cloneUnitRecursive(child.id, child.name, child.type, newUnit.id, allUnits, allRoles);
    }

    return newUnit;
}

/* DELETE org unit */
router.delete('/:id', async function (req, res) {
    try {
        const unit = await postgres.OrgUnits.entity({ id: req.params.id });
        if (!unit) return res.status(400).json(resBuilder.fail("Org unit not found"));
        await unit.destroy();
        return res.status(200).json(resBuilder.success({ deleted: true }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while deleting org unit"));
    }
});

module.exports = router;
