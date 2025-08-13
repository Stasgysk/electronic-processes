// server.js

const fs = require('fs');
const https = require('https');
const path = require('path');
const app = require('./app');

const key = fs.readFileSync(path.join(__dirname, 'cert', 'server.key'));
const cert = fs.readFileSync(path.join(__dirname, 'cert', 'server.cert'));

const options = { key, cert };

const port = process.env.PORT || 3000;
https.createServer(options, app).listen(port, () => {
    logger.info(`HTTPS server running at https://localhost: ${port}`);
});