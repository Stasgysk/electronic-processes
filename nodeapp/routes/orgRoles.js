/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();

// returns roles stripped of their accessCode — only exposes whether a code exists.
// used by the profile page so users can see which roles they can join.
router.get('/browseable', async function (req, res) {
    try {
        const { OrgUnits } = postgres;
        const roles = await postgres.OrgRoles.findAll({
            include: [{ model: OrgUnits, as: 'OrgUnit', attributes: ['id', 'name', 'type'] }],
            limit: 1000,
            order: [['name', 'ASC']],
        });
        const result = roles.map(r => ({
            id: r.id,
            name: r.name,
            orgUnitId: r.orgUnitId,
            hasCode: !!r.accessCode, // true/false — never expose the actual code
            OrgUnit: r.OrgUnit,
        }));
        return res.status(200).json(resBuilder.success(result));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting browseable roles"));
    }
});

/* GET roles — optionally filtered by orgUnitId */
router.get('/', async function (req, res) {
    try {
        const { orgUnitId } = req.query;
        const where = orgUnitId ? { orgUnitId: parseInt(orgUnitId) } : null;
        const roles = await postgres.OrgRoles.entities(where, true, [], 500, 0);
        return res.status(200).json(resBuilder.success(roles));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting org roles"));
    }
});

/* POST create role */
router.post('/', async function (req, res) {
    try {
        const { name, orgUnitId, emailPattern, accessCode, isStudentRole, sortOrder } = req.body;
        if (!name || !orgUnitId) return res.status(400).json(resBuilder.fail("name and orgUnitId are required"));

        const role = await postgres.OrgRoles.create({
            name,
            orgUnitId: parseInt(orgUnitId),
            emailPattern: emailPattern || null,
            accessCode: accessCode || null,
            isStudentRole: !!isStudentRole,
            sortOrder: sortOrder != null ? parseInt(sortOrder) : null,
        });

        // if a pattern was set, immediately assign all existing users whose email matches
        if (emailPattern) {
            await autoAssignByPattern(role.id, emailPattern);
        }

        return res.status(200).json(resBuilder.success(role));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while creating org role"));
    }
});

/* PATCH update role */
router.patch('/:id', async function (req, res) {
    try {
        const role = await postgres.OrgRoles.entity({ id: req.params.id });
        if (!role) return res.status(400).json(resBuilder.fail("Org role not found"));

        const { name, emailPattern, accessCode, isStudentRole, sortOrder } = req.body;
        if (name !== undefined) role.name = name;
        if (emailPattern !== undefined) role.emailPattern = emailPattern || null;
        if (accessCode !== undefined) role.accessCode = accessCode || null;
        if (isStudentRole !== undefined) role.isStudentRole = !!isStudentRole;
        if (sortOrder !== undefined) role.sortOrder = sortOrder != null ? parseInt(sortOrder) : null;
        await role.save();

        // re-run auto-assignment in case the pattern changed
        if (emailPattern) {
            await autoAssignByPattern(role.id, emailPattern);
        }

        return res.status(200).json(resBuilder.success(role));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while updating org role"));
    }
});

/* DELETE role */
router.delete('/:id', async function (req, res) {
    try {
        const role = await postgres.OrgRoles.entity({ id: req.params.id });
        if (!role) return res.status(400).json(resBuilder.fail("Org role not found"));
        await role.destroy();
        return res.status(200).json(resBuilder.success({ deleted: true }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while deleting org role"));
    }
});

// walks all users and assigns them to this role if their email contains the pattern.
// tied to the current semester so the assignment gets the right validity dates.
async function autoAssignByPattern(orgRoleId, emailPattern) {
    const currentSemester = await postgres.Semesters.entity({ isCurrent: true });
    const semesterId = currentSemester ? currentSemester.id : null;
    const allUsers = await postgres.Users.findAll({ limit: 5000 });
    for (const user of allUsers) {
        if (user.email && user.email.includes(emailPattern)) {
            const existing = await postgres.UserOrgRoles.entity({ userId: user.id, orgRoleId, semesterId });
            if (!existing) {
                await postgres.UserOrgRoles.create({
                    userId: user.id,
                    orgRoleId,
                    semesterId,
                    validFrom: currentSemester?.startDate || null,
                    validTo: currentSemester?.endDate || null,
                });
            }
        }
    }
}

module.exports = router;
