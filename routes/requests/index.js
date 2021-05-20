const express = require("express");
const { pool, formatDate } = require("../../config");
const router = express.Router();
const { isAuth, isStaff } = require("../auth/auth-jwt");

router.post("/requests", isAuth, async (req, res) => {
  let { selectedRoomId, draftPurpose, startDate, endDate } = req.body;
  const { uid } = req.user;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    let sql1 = `SELECT * 
                FROM request 
                WHERE room_id = ? 
                AND end_datetime >= ? 
                AND start_datetime <= ?
                AND status = 'approved'`;
    let params1 = [
      selectedRoomId,
      formatDate(startDate),
      formatDate(endDate),
      uid,
    ];
    const [rows, _] = await conn.query(sql1, params1);
    if (rows.length > 0) {
      return res.json({ status: false, periods: rows });
    }

    let sql2 = `INSERT INTO request (room_id, purpose, start_datetime, end_datetime, request_by, create_datetime) 
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    let params2 = [
      selectedRoomId,
      draftPurpose,
      formatDate(startDate),
      formatDate(endDate),
      uid,
    ];
    await conn.query(sql2, params2);
    conn.commit();
    return res.json({ status: true });
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

router.get("/requests", isAuth, async (req, res) => {
  const { uid, role } = req.user;

  let sql = "";
  let params = [];

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    if (role === "staff") {
      sql = ` SELECT request_id, room_name, purpose, start_datetime, end_datetime, status
              FROM request
              JOIN room
              USING (room_id)
              ORDER BY request_id DESC`;
    } else if (role === "student") {
      sql = ` SELECT request_id, room_name, purpose, start_datetime, end_datetime, status
              FROM request
              JOIN room
              USING (room_id)
              WHERE request_by = ?
              ORDER BY request_id DESC`;
      params = [uid];
    }
    const [rows, _] = await conn.query(sql, params);
    conn.commit();

    if (rows.length > 0) {
      return res.json(rows);
    } else {
      return res.json([]);
    }
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

router.get("/requests/:id", isAuth, async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    let sql = `
    SELECT rq.request_id, r.room_id, r.room_name, rq.purpose, rq.start_datetime, rq.end_datetime, 
    rq.status, rq.create_datetime, 
    a.username request_by,
    (SELECT username FROM account WHERE account_id = rq.review_by) review_by,
    (SELECT role FROM staff WHERE account_id = rq.review_by) staff_role
    FROM request rq
    JOIN room r
    ON (r.room_id = rq.room_id)
    JOIN account a
    ON (rq.request_by = a.account_id)
    WHERE rq.request_id = ?`;
    let params = [req.params.id];

    const [[request]] = await conn.query(sql, params);
    conn.commit();

    if (request) {
      return res.json(request);
    } else {
      return res.json([]);
    }
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

router.put("/requests/:id", isAuth, isStaff, async (req, res) => {
  let { status } = req.body;
  let { uid } = req.user;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    if (status === "approved") {
      const [[request]] = await conn.query(
        `SELECT * FROM request WHERE request_id = ?`,
        [req.params.id]
      );

      const [periods, _] = await conn.query(
        ` SELECT * 
          FROM request 
          WHERE room_id = ? 
          AND end_datetime >= ? 
          AND start_datetime <= ?
          AND status = 'approved'`,
        [
          request?.room_id,
          formatDate(request?.start_datetime),
          formatDate(request?.end_datetime),
        ]
      );

      if (periods.length > 0) {
        return res.json({ status: false, periods });
      }
    }

    let sql = `
        UPDATE request SET status = ?, review_by = ?
        WHERE request_id = ?`;
    let params = [status, uid, req.params.id];

    await conn.query(sql, params);
    conn.commit();
    return res.json({ status: true });
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

module.exports = router;
