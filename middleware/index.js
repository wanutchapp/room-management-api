const { pool } = require("../config");

const isWishlistOwner = async (req, res, next) => {
  const { uid } = req.user;
  console.log(req.params.id);
  const [
    [wishlist],
  ] = await pool.query(
    `SELECT * FROM wishlist WHERE wishlist_id = ? AND account_id = ?`,
    [req.params.id, uid]
  );
  console.log(wishlist);
  if (!wishlist) {
    return res
      .status(403)
      .send("You do not have permission to perform this action");
  }

  next();
};

const isRequestOwner = async (req, res, next) => {
  const { uid } = req.user;

  const [
    [request],
  ] = await pool.query(
    "SELECT request_by FROM request WHERE request_id = ? AND request_by = ?",
    [req.params.id, uid]
  );

  if (req.user.role === "staff") {
    return next();
  }

  if (!request) {
    return res
      .status(403)
      .send("You do not have permission to perform this action");
  }

  next();
};

const isStudent = async (req, res, next) => {
  const [
    [user],
  ] = await pool.query("SELECT account_id FROM student WHERE account_id = ?", [
    req.user.uid,
  ]);

  if (user) {
    return next();
  }

  return res
    .status(403)
    .send("You do not have permission to perform this action");
};

const isStaff = async (req, res, next) => {
  const [
    [user],
  ] = await pool.query("SELECT account_id FROM staff WHERE account_id = ?", [
    req.user.uid,
  ]);

  if (user) {
    return next();
  }
  return res
    .status(403)
    .send("You do not have permission to perform this action");
};

module.exports = {
  isWishlistOwner,
  isRequestOwner,
  isStudent,
  isStaff,
};
