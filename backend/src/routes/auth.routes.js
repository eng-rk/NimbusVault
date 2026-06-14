const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || "dev_secret_key",
    { expiresIn: "7d" },
  );
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    const exists = await User.findOne({
      email: email.toLowerCase(),
    });

    if (exists) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: "user",
    });

    const safeUser = user.toObject();
    delete safeUser.password;

    res.status(201).json({
      token: createToken(user),
      user: safeUser,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const safeUser = user.toObject();
    delete safeUser.password;

    res.json({
      token: createToken(user),
      user: safeUser,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/me", (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
