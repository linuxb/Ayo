const config = require('../constants/db');
const _Promise = require('bluebird');
const mysql = require('mysql');

let connection = mysql.createConnection({
    host: config.host,
    user: config.user,
    database: config.database,
    password: config.password
});

// module.exports = connection;
module.exports = _Promise.promisifyAll(connection);
