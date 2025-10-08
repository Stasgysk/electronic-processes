var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* GET test route */
router.post('/test', async function (req, res, next) {
  //await launchTest();
  console.log(req.body);
  return res.status(200).json(resBuilder.success(req.body));
})

module.exports = router;
