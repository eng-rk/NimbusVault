// require mongoose
// create schema
// create model
// export
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            minlength: 6,
            // null when Google OAuth user
            default: null,
        },
        role: {
            type: String,
            enum: ["admin", "user"],
            default: "user",
        },
        googleId: {
            type: String,
            default: null,
        },
        avatar: {
            type: String,
            default: null,
        },
        // bytes used out of STORAGE_LIMIT_BYTES
        storageUsed: {
            type: Number,
            default: 0,
        },
        isSubscribed: {
            type: Boolean,
            default: false,
        },
        subscriptionPlan: {
            type: String,
            enum: ["free", "premium"],
            default: "free",
        },
        subscriptionExpiresAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
