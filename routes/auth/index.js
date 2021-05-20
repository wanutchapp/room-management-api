const express = require("express");
const { pool } = require("../../config");
const router = express.Router();
const { generateToken, isAuth } = require("./auth-jwt");

router.get("/auth/me", isAuth, async (req, res) => {
  const { username, role } = req.user;
  const [[user]] = await pool.query(
    ` SELECT username, type 
      FROM account 
      WHERE username = ? 
      AND type = ?`,
    [username, role]
  );

  if (!user) {
    return res.status(401).json({
      message: "Invalid User",
    });
  }

  return res.json({
    user: {
      username: user.username,
      role: user.type,
    },
  });
});

router.post("/auth/login", async (req, res, next) => {
  const { username, password } = req.body;
  const [[user]] = await pool.query(
    ` SELECT account_id, username, password, type 
      FROM account 
      WHERE username = ?`,
    [username]
  );

  try {
    if (!user) {
      throw new Error("Incorrect username or password");
    }

    if (password !== user.password) {
      throw new Error("Incorrect username or password");
    }

    const accessToken = generateToken({
      account_id: user.account_id,
      username: user.username,
      role: user.type,
    });
    return res.json({
      user: {
        token: accessToken,
      },
    });
  } catch (error) {
    res.status(400).json(error.toString());
  }
});

module.exports = router;
