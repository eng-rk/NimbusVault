const express = require("express");
const router = express.Router();
const passport = require("passport");
const authMiddleware = require("../Middleware/authMiddleware");
const {
    register,
    login,
    googleSuccess,
    getProfile,
    subscribeUser,
    cancelSubscriptionUser
} = require("../controller/authController");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getProfile);
router.post("/subscribe", authMiddleware, subscribeUser);
router.post("/cancel-subscription", authMiddleware, cancelSubscriptionUser);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/login", session: false }),
    googleSuccess
);

module.exports = router;
