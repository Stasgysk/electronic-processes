/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();

/* GET current user's workplaces */
router.get('/me', async function (req, res) {
    try {
        const workplaces = await postgres.UserWorkplaces.entities({ userId: req.userId });
        return res.status(200).json(resBuilder.success(workplaces));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting workplaces"));
    }
});

/* POST add workplace for current user */
router.post('/', async function (req, res) {
    try {
        const { orgUnitId } = req.body;
        if (!orgUnitId) return res.status(400).json(resBuilder.fail("orgUnitId is required"));

        const unit = await postgres.OrgUnits.entity({ id: parseInt(orgUnitId) });
        if (!unit) return res.status(400).json(resBuilder.fail("Org unit not found"));

        const existing = await postgres.UserWorkplaces.entity({ userId: req.userId, orgUnitId: parseInt(orgUnitId) });
        if (existing) return res.status(200).json(resBuilder.success(existing));

        const wp = await postgres.UserWorkplaces.create({ userId: req.userId, orgUnitId: parseInt(orgUnitId) });
        return res.status(200).json(resBuilder.success(wp));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while adding workplace"));
    }
});

/* DELETE remove workplace */
router.delete('/:id', async function (req, res) {
    try {
        const wp = await postgres.UserWorkplaces.entity({ id: req.params.id, userId: req.userId });
        if (!wp) return res.status(400).json(resBuilder.fail("Workplace not found"));
        await wp.destroy();
        return res.status(200).json(resBuilder.success({ deleted: true }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while removing workplace"));
    }
});

module.exports = router;
