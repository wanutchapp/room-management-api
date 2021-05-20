const mysql = require("mysql2/promise");
const moment = require("moment-timezone");

module.exports.pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "room_management",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports.formatDate = (date) => {
  let tzDate = moment.tz(date, "Asia/Bangkok");
  return tzDate.format();
};
