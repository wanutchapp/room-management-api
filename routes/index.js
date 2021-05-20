const auth = require("./auth");
const rooms = require("./rooms");
const requests = require("./requests");

const express = require("express");
const router = express.Router();

router.use(auth);
router.use(rooms);
router.use(requests);

module.exports = router;
