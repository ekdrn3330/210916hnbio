const mysql = require('mysql');
const config = require('./db_config.json');

const conn = mysql.createPool(config);

module.exports = conn;