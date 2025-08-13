/* global logger */
/* global resBuilder */

let express = require('express');
let router = express.Router();

/* GET users listing. */
router.get('/', async function (req, res, next) {
  const users = await postgres.FormsStatus.entity({id: 1}, true);

  return res.status(200).json(resBuilder.success(users));
});

module.exports = router;
