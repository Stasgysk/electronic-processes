/* global logger */
/* global resBuilder */

const express = require('express');
const router = express.Router();

/* GET all semesters */
router.get('/', async function (req, res) {
    try {
        const semesters = await postgres.Semesters.entities();
        return res.status(200).json(resBuilder.success(semesters));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting semesters"));
    }
});

/* POST create semester */
router.post('/', async function (req, res) {
    try {
        const { name, type, academicYear, startDate, endDate } = req.body;
        if (!name || !type || !academicYear || !startDate || !endDate) {
            return res.status(400).json(resBuilder.fail("name, type, academicYear, startDate and endDate are required"));
        }
        const semester = await postgres.Semesters.create({ name, type, academicYear, startDate, endDate });
        return res.status(200).json(resBuilder.success(semester));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while creating semester"));
    }
});

/* PUT update semester */
router.put('/:id', async function (req, res) {
    try {
        const semester = await postgres.Semesters.entity({ id: parseInt(req.params.id) });
        if (!semester) return res.status(400).json(resBuilder.fail("Semester not found"));

        const { name, type, academicYear, startDate, endDate } = req.body;
        if (name !== undefined) semester.name = name;
        if (type !== undefined) semester.type = type;
        if (academicYear !== undefined) semester.academicYear = academicYear;
        if (startDate !== undefined) semester.startDate = startDate;
        if (endDate !== undefined) semester.endDate = endDate;
        await semester.save();
        return res.status(200).json(resBuilder.success(semester));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while updating semester"));
    }
});

/* DELETE semester */
router.delete('/:id', async function (req, res) {
    try {
        const semester = await postgres.Semesters.entity({ id: parseInt(req.params.id) });
        if (!semester) return res.status(400).json(resBuilder.fail("Semester not found"));
        if (semester.isCurrent) return res.status(400).json(resBuilder.fail("Cannot delete the current semester"));
        await semester.destroy();
        return res.status(200).json(resBuilder.success({ deleted: true }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while deleting semester"));
    }
});

/* POST activate semester */
router.post('/:id/activate', async function (req, res) {
    try {
        const semester = await postgres.Semesters.entity({ id: parseInt(req.params.id) });
        if (!semester) return res.status(400).json(resBuilder.fail("Semester not found"));
        await postgres.Semesters.update({ isCurrent: false }, { where: {} });
        semester.isCurrent = true;
        await semester.save();
        return res.status(200).json(resBuilder.success(semester));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while activating semester"));
    }
});

/* GET transition preview */
router.get('/:id/transition/preview', async function (req, res) {
    try {
        const { fromSemesterId } = req.query;
        if (!fromSemesterId) return res.status(400).json(resBuilder.fail("fromSemesterId is required"));
        const preview = await buildTransitionPreview(parseInt(fromSemesterId), parseInt(req.params.id));
        return res.status(200).json(resBuilder.success(preview));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while building preview"));
    }
});

/* POST transition students to new semester */
router.post('/:id/transition/students', async function (req, res) {
    try {
        const { fromSemesterId } = req.body;
        if (!fromSemesterId) return res.status(400).json(resBuilder.fail("fromSemesterId is required"));
        const result = await executeStudentTransition(parseInt(fromSemesterId), parseInt(req.params.id));
        return res.status(200).json(resBuilder.success(result));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while transitioning students"));
    }
});

/* POST copy professor assignments to new semester */
router.post('/:id/copy-professors', async function (req, res) {
    try {
        const { fromSemesterId } = req.body;
        if (!fromSemesterId) return res.status(400).json(resBuilder.fail("fromSemesterId is required"));
        const result = await executeCopyProfessors(parseInt(fromSemesterId), parseInt(req.params.id));
        return res.status(200).json(resBuilder.success(result));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while copying professors"));
    }
});

async function getStudentAssignments(semesterId) {
    return postgres.UserOrgRoles.findAll({
        where: { semesterId },
        include: [{
            model: postgres.OrgRoles,
            as: 'OrgRole',
            required: true,
            where: { isStudentRole: true },
            include: [{ model: postgres.OrgUnits, as: 'OrgUnit', required: true }],
        }],
    });
}

async function getProfessorAssignments(semesterId) {
    return postgres.UserOrgRoles.findAll({
        where: { semesterId },
        include: [{
            model: postgres.OrgRoles,
            as: 'OrgRole',
            required: true,
            where: { isStudentRole: false },
        }],
    });
}

async function resolveNextRole(currentRole, isYearTransition) {
    if (!isYearTransition) return { type: 'same' };
    if (currentRole.sortOrder === null || currentRole.sortOrder === undefined) return { type: 'graduate' };

    const nextRole = await postgres.OrgRoles.findOne({
        where: { sortOrder: currentRole.sortOrder + 1, isStudentRole: true },
        include: [{
            model: postgres.OrgUnits,
            as: 'OrgUnit',
            required: true,
            where: { parentId: currentRole.OrgUnit.parentId },
        }],
    });
    if (!nextRole) return { type: 'graduate' };

    return { type: 'advance', nextOrgRoleId: nextRole.id };
}

async function buildTransitionPreview(fromSemesterId, toSemesterId) {
    const fromSemester = await postgres.Semesters.entity({ id: fromSemesterId });
    const toSemester = await postgres.Semesters.entity({ id: toSemesterId });
    if (!fromSemester || !toSemester) throw new Error("Semester not found");

    const isYearTransition = fromSemester.type === 'LETNY' && toSemester.type === 'ZIMNY';
    const studentAssignments = await getStudentAssignments(fromSemesterId);

    let transitioning = 0;
    let graduating = 0;
    for (const assignment of studentAssignments) {
        const resolution = await resolveNextRole(assignment.OrgRole, isYearTransition);
        if (resolution.type === 'graduate') graduating++;
        else transitioning++;
    }

    const professorAssignments = await getProfessorAssignments(fromSemesterId);

    return {
        isYearTransition,
        studentsTransitioning: transitioning,
        studentsGraduating: graduating,
        professorsTotal: professorAssignments.length,
    };
}

async function executeStudentTransition(fromSemesterId, toSemesterId) {
    const fromSemester = await postgres.Semesters.entity({ id: fromSemesterId });
    const toSemester = await postgres.Semesters.entity({ id: toSemesterId });
    if (!fromSemester || !toSemester) throw new Error("Semester not found");

    const isYearTransition = fromSemester.type === 'LETNY' && toSemester.type === 'ZIMNY';
    const studentAssignments = await getStudentAssignments(fromSemesterId);

    let transitioned = 0;
    let graduating = 0;
    for (const assignment of studentAssignments) {
        const resolution = await resolveNextRole(assignment.OrgRole, isYearTransition);
        if (resolution.type === 'graduate') {
            graduating++;
            continue;
        }
        const newOrgRoleId = resolution.type === 'advance' ? resolution.nextOrgRoleId : assignment.orgRoleId;
        const existing = await postgres.UserOrgRoles.findOne({
            where: { userId: assignment.userId, orgRoleId: newOrgRoleId, semesterId: toSemesterId },
        });
        if (!existing) {
            await postgres.UserOrgRoles.create({
                userId: assignment.userId,
                orgRoleId: newOrgRoleId,
                semesterId: toSemesterId,
                validFrom: toSemester.startDate,
                validTo: toSemester.endDate,
            });
        }

        if (resolution.type === 'advance') {
            const newOrgRole = await postgres.OrgRoles.findOne({ where: { id: newOrgRoleId } });
            if (newOrgRole?.orgUnitId) {
                await postgres.Users.update({ orgUnitId: newOrgRole.orgUnitId }, { where: { id: assignment.userId } });
            }
        }
        transitioned++;
    }

    return { transitioned, graduating };
}

async function executeCopyProfessors(fromSemesterId, toSemesterId) {
    const toSemester = await postgres.Semesters.entity({ id: toSemesterId });
    if (!toSemester) throw new Error("Semester not found");

    const professorAssignments = await getProfessorAssignments(fromSemesterId);
    let copied = 0;
    for (const assignment of professorAssignments) {
        const existing = await postgres.UserOrgRoles.findOne({
            where: { userId: assignment.userId, orgRoleId: assignment.orgRoleId, semesterId: toSemesterId },
        });
        if (!existing) {
            await postgres.UserOrgRoles.create({
                userId: assignment.userId,
                orgRoleId: assignment.orgRoleId,
                semesterId: toSemesterId,
                validFrom: toSemester.startDate,
                validTo: toSemester.endDate,
            });
        }
        copied++;
    }
    return { copied };
}

module.exports = router;
