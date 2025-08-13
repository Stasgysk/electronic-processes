/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();

/* GET users groups */
router.get('/', async function (req, res, next) {
    const usersGroups = await postgres.UsersGroups.entities();

    return res.status(200).json(resBuilder.success(usersGroups));
});

module.exports = router;
