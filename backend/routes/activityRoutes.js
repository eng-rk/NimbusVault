const express = require("express");
const router = Router = express.Router();
const authMiddleware = require("../Middleware/authMiddleware");
const { getActivities } = require("../controller/activityController");

router.get("/", authMiddleware, getActivities);

module.exports = router;
