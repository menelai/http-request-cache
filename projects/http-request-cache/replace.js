const fs = require('fs');

const name = '../../dist/http-request-cache/package.json';

const data = fs.readFileSync(name, 'utf-8');
fs.writeFileSync(name, data.replace('"node": "./fesm2015/kovalenko-http-request-cache.mjs",', '"node": "./public-api.js",'), 'utf-8');

