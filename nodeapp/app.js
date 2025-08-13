require('dotenv').config();
let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let http = require('http');
const axiosLogger = require('./utils/AxiosLogger');

let indexRouter = require('./routes/index');
let usersRouter = require('./routes/users');
let usersGroupsRouter = require('./routes/usersGroups');
let formsRouter = require('./routes/forms');
let formsStatusesRouter = require('./routes/formsStatuses');
let processesRouter = require('./routes/processes');
let n8nRouter = require('./routes/n8n');
const fs = require("fs");
let logger = require('./utils/Logger');
let resBuilder = require('./utils/ResponseBuilder');
const routesUtils = require('./utils/RoutesUtils');

let app = express();

global.environment = process.env.NODE_ENV;
global.logger = logger;
global.resBuilder = resBuilder;
global.routesUtils = routesUtils;

const createConfig = () => {
  if (fs.existsSync(__dirname + "/config/config." + global.environment + ".js")) {
    logger.info("Config load: " + global.environment);
    return require(__dirname + "/config/config." + global.environment + ".js");
  }
  logger.warn(new Date() + " - Config " + global.environment + " not found! Default loaded");
  return require(__dirname + "/config/config.js");
};

app.locals.config = global.config = createConfig();
global.postgres = require('./libs/postgres');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function logResponse(req, res, next) {
  const originalJson = res.json;
  const statusMessage = http.STATUS_CODES[res.statusCode] || 'Unknown Status';

  const clientIp = req.ip || req.connection.remoteAddress;
  res.json = function (data) {
    logger.info(`${clientIp} - "${req.method} ${req.originalUrl} HTTP/${req.httpVersion}" ${res.statusCode} ${statusMessage}`);
    return originalJson.call(this, data);
  };

  next();
}

app.use(logResponse);

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/usersGroups', usersGroupsRouter);
app.use('/forms', formsRouter);
app.use('/formsStatuses', formsStatusesRouter);
app.use('/processes', processesRouter);
app.use('/n8n', n8nRouter);

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
