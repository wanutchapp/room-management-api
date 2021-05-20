const express = require("express");
const { pool, formatDate } = require("../../config");
const router = express.Router();
const { isAuth } = require("../auth/auth-jwt");
const { isStaff } = require("../../middleware");

router.get("/rooms", async (req, res) => {
  // getConnection -> เริ่มต้นเชื่อมต่อฐานข้อมูล
  const conn = await pool.getConnection();
  // Begin Transaction
  await conn.beginTransaction();
  try {
    //กำหนดคำสั่ง SQL สำหรับ Query
    let sql = ` SELECT room_id, room_name, room_capacity, type_name as room_type 
                FROM room 
                JOIN room_type 
                USING (type_id) 
                ORDER BY room_name ASC`;
    //กำหนด Parameter สำหรับ Query
    let params = [];

    //ประกาศตัวแปร รอรับข้อมูลจากการ Query
    const [rows, _] = await conn.query(sql, params);

    // Commit Transaction
    conn.commit();

    // หากมีข้อมูลมากกว่า 0 ข้อมูล ทำการ Response ข้อมูล ไปยัง Frontend
    if (rows.length > 0) {
      return res.json(rows);
    } else {
      // หากไม่มีข้อมูล ทำการ Response NULL ไปยัง Frontend
      return res.json(null);
    }
  } catch (err) {
    console.log(err);
    // Rollback Transaction หากการ Query ด้านบนมี Error
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    // ReleaseConnection -> หยุดการเชื่อมต่อฐานข้อมูล
    conn.release();
  }
});

router.get("/rooms/:id", async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    let sql = ` SELECT room_id, room_name, room_capacity, type_id, type_name as room_type
                FROM room 
                JOIN room_type 
                USING (type_id) 
                WHERE room_id = ?`;
    let params = [req.params.id];

    const [[room]] = await conn.query(sql, params);
    conn.commit();

    if (room) {
      return res.json(room);
    } else {
      return res.json(null);
    }
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

router.post("/rooms", isAuth, isStaff, async (req, res) => {
  let { room_name, room_capacity, type_id } = req.body;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [rows, _] = await conn.query(
      ` SELECT * 
        FROM room 
        WHERE LOWER(room_name) = ?
        AND type_id = ?`,
      [room_name.toLowerCase(), type_id]
    );

    if (rows.length > 0) {
      return res.json({ status: false });
      //"You can not add exist room."
    }

    let sql = `INSERT INTO room (room_name, room_capacity, type_id) VALUES (?, ?, ?)`;
    let params = [room_name, room_capacity, type_id];
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

router.put("/rooms/:id", isAuth, isStaff, async (req, res) => {
  let { room_name, room_capacity, type_id } = req.body;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [rows, _] = await conn.query(
      ` SELECT * 
        FROM room 
        WHERE LOWER(room_name) = ?
        AND type_id = ?
        AND room_id != ?`,
      [room_name.toLowerCase(), type_id, req.params.id]
    );
    if (rows.length > 0) {
      return res.json({ status: false });
      //"You can not save with same as exist room. but you can still update"
    }

    let sql = `UPDATE room SET room_name = ?, room_capacity = ?, type_id = ? WHERE room_id = ?`;
    let params = [room_name, room_capacity, type_id, req.params.id];
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

router.delete("/rooms/:id", isAuth, isStaff, async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    // Check that room is no relationship with other.
    const [[rows1]] = await conn.query(
      "SELECT COUNT(*) FROM request WHERE room_id = ?",
      [req.params.id]
    );

    if (rows1["COUNT(*)"] > 0) {
      return res.json({ status: false });
    }
    await conn.query(`DELETE FROM room WHERE room_id = ?`, [req.params.id]);
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

router.post("/rooms/status/:id", async (req, res) => {
  let { startDate, endDate } = req.body;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    let sql = ` SELECT * 
                FROM request 
                WHERE room_id = ? 
                AND end_datetime >= ? 
                AND start_datetime <= ?
                AND status = 'approved'`;
    let params = [req.params.id, formatDate(startDate), formatDate(endDate)];

    const [rows, _] = await conn.query(sql, params);
    conn.commit();

    if (rows.length > 0) {
      return res.json({ room_status: "Not Available", periods: rows });
    } else {
      return res.json({ room_status: "Available", periods: [] });
    }
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

router.post("/rooms/search", async (req, res) => {
  let { searchTerm, startDate, endDate } = req.body;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    let sql = `   SELECT room_id, room_name, room_capacity, type_id, type_name as room_type
                  FROM room 
                  JOIN room_type 
                  USING (type_id) 
                  WHERE room_name LIKE ?
                  AND room_id NOT IN (SELECT room_id FROM request WHERE end_datetime >= ? AND start_datetime <= ? AND status = 'approved') 
                  ORDER BY room_name`;
    let params = [
      `%${searchTerm}%`,
      formatDate(startDate),
      formatDate(endDate),
    ];

    const [rows, _] = await conn.query(sql, params);
    conn.commit();

    if (rows.length > 0) {
      return res.json(rows);
    } else {
      return res.json(null);
    }
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

router.get("/roomtypes", async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    let sql = ` SELECT type_id, type_name
                  FROM room_type 
                  ORDER BY type_name ASC`;
    let params = [];
    const [rows, _] = await conn.query(sql, params);
    conn.commit();

    if (rows.length > 0) {
      return res.json(rows);
    } else {
      return res.json(null);
    }
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

router.get("/roomtypes/:id", async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    let sql = `SELECT type_id, type_name FROM room_type WHERE type_id = ?`;
    let params = [req.params.id];
    const [[roomtype]] = await conn.query(sql, params);
    conn.commit();

    if (roomtype) {
      return res.json(roomtype);
    } else {
      return res.json(null);
    }
  } catch (err) {
    console.log(err);
    conn.rollback();
    res.status(400).json(err.toString());
  } finally {
    conn.release();
  }
});

router.put("/roomtypes/:id", isAuth, isStaff, async (req, res) => {
  let { type_name } = req.body;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [rows, _] = await conn.query(
      ` SELECT * 
          FROM room_type 
          WHERE LOWER(type_name) = ?
          AND type_id != ?`,
      [type_name.toLowerCase(), req.params.id]
    );

    if (rows.length > 0) {
      return res.json({ status: false });
      //"You can not save with same as exist roomtype. but you can still update"
    }

    let sql = `UPDATE room_type SET type_name = ? WHERE type_id = ?`;
    let params = [type_name, req.params.id];
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

router.post("/roomtypes", isAuth, isStaff, async (req, res) => {
  let { type_name } = req.body;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [rows, _] = await conn.query(
      ` SELECT * 
          FROM room_type 
          WHERE LOWER(type_name) = ?`,
      [type_name.toLowerCase()]
    );

    if (rows.length > 0) {
      return res.json({ status: false });
      //"You can not add exist roomtype."
    }

    let sql = `INSERT INTO room_type (type_name) VALUES (?)`;
    let params = [type_name];
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

router.delete("/roomtypes/:id", isAuth, isStaff, async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    // Check that room is no relationship with other.
    const [[rows1]] = await conn.query(
      "SELECT COUNT(*) FROM room WHERE type_id = ?",
      [req.params.id]
    );

    if (rows1["COUNT(*)"] > 0) {
      return res.json({ status: false });
    }
    await conn.query(`DELETE FROM room_type WHERE type_id = ?`, [
      req.params.id,
    ]);
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
