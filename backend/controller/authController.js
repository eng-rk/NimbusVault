const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { registerSchema, loginSchema } = require("./validation/authValidation");

const register = async (req, res) => {
    try {
        // get data from req.body
        const { userName, email, password, role } = req.body;

        // validation data
        const { error } = registerSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            return res.status(400).json({ msg: error.details.map((d) => d.message).join(", ") });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: "Account Already Exist" });
        }

        // create
        const hashPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            userName,
            email,
            password: hashPassword,
            role: role || "user"
        });

        // response
        res.status(201).json({
            msg: "Done Created User",
            data: {
                id: newUser._id,
                userName: newUser.userName,
                email: newUser.email,
                role: newUser.role,
                storageUsed: newUser.storageUsed
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

const login = async (req, res) => {
    try {
        // get data from req.body
        const { email, password } = req.body;

        // validation data
        const { error } = loginSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ msg: error.details.map((d) => d.message).join(", ") });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: "Account Not Found" });
        }

        if (user.googleId && !user.password) {
            return res.status(400).json({ msg: "Please login using Google OAuth" });
        }

        const matchPassword = await bcrypt.compare(password, user.password);
        if (!matchPassword) {
            return res.status(400).json({ msg: "Invalid Password" });
        }

        // create
        const token = jwt.sign(
            { id: user._id, role: user.role, userName: user.userName, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // response
        res.status(200).json({
            msg: "Success Login",
            token,
            data: {
                id: user._id,
                userName: user.userName,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                storageUsed: user.storageUsed
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

const googleSuccess = async (req, res) => {
    try {
        // get data from req.body
        const user = req.user;

        // create
        const token = jwt.sign(
            { id: user._id, role: user.role, userName: user.userName, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // response
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/oauth-callback?token=${token}`);
    } catch (error) {
        console.log(error);
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/login?error=OAuthFailed`);
    }
};

module.exports = {
    register,
    login,
    googleSuccess
};
