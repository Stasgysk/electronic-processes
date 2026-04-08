/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();

/* POST create or update a form condition */
router.post('/', async function (req, res) {
    try {
        const { processId, sourceFormId, targetFormId, fieldName, operator, expectedValue } = req.body;

        if (!processId || !sourceFormId || !targetFormId || !fieldName || !operator || expectedValue === undefined || expectedValue === null) {
            return res.status(400).json(resBuilder.fail('Bad request'));
        }

        const existing = await postgres.FormConditions.entity({ processId, sourceFormId, targetFormId });

        if (existing) {
            existing.fieldName = fieldName;
            existing.operator = operator;
            existing.expectedValue = String(expectedValue);
            await existing.save();
            return res.status(200).json(resBuilder.success(existing));
        }

        const condition = await postgres.FormConditions.create({
            processId,
            sourceFormId,
            targetFormId,
            fieldName,
            operator,
            expectedValue: String(expectedValue),
        });

        return res.status(200).json(resBuilder.success(condition));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error('Something went wrong while creating form condition'));
    }
});

/* GET all conditions for a process */
router.get('/:processId', async function (req, res) {
    try {
        const conditions = await postgres.FormConditions.entities({ processId: req.params.processId });
        return res.status(200).json(resBuilder.success(conditions));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error('Something went wrong while getting form conditions'));
    }
});

module.exports = router;
