const express = require("express");
const router = express.Router();
const passport = require("passport");
const { register, login, googleSuccess } = require("../controller/authController");

router.post("/register", register);
router.post("/login", login);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/login", session: false }),
    googleSuccess
);

module.exports = router;
