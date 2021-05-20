const jwt = require("jsonwebtoken");
const accessTokenSecret = ")J@NcRfUjXn2r5u7x!A%D*G-KaPdSgVk";
const { pool, formatDate } = require("../../config");

function generateToken(data) {
  return jwt.sign(
    { uid: data.account_id, username: data.username, role: data.role },
    accessTokenSecret
  );
}

function isAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.includes("Bearer ")) {
    return res.json({
      requireAuth: true,
      message: "Invalid token",
    });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, accessTokenSecret, (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "JWT must be provided",
      });
    }
    req.user = user;
    console.log(req.user);
    next();
  });
}

const isStaff = async (req, res, next) => {
  const [[user]] = await pool.query(
    "SELECT account_id FROM staff WHERE account_id = ?",
    [req.user.uid]
  );

  if (user) {
    return next();
  }
  return res
    .status(403)
    .send("You do not have permission to perform this action");
};

module.exports = {
  generateToken,
  isAuth,
  isStaff,
};
