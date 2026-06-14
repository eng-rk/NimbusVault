// require mongoose
// create schema
// create model
// export
const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        folderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Folder",
            default: null,
        },
        originalName: {
            type: String,
            required: true,
        },
        storedName: {
            type: String,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            required: true,
        },
        category: {
            type: String,
            enum: ["pdf", "word", "excel", "powerpoint", "image", "video", "audio", "other"],
            default: "other",
        },
        // who owns the storage charge for this file
        chargedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        permission: {
            type: String,
            enum: ["private", "public"],
            default: "private",
        },
        isStarred: {
            type: Boolean,
            default: false,
        },
        isTrashed: {
            type: Boolean,
            default: false,
        },
        trashedAt: {
            type: Date,
            default: null,
        },
        // hashed password for file lock
        passwordLock: {
            type: String,
            default: null,
        },
        // token for public sharing link
        publicToken: {
            type: String,
            default: null,
        },
        publicTokenExpiry: {
            type: Date,
            default: null,
        },
        sharedWith: [
            {
                userEmail: String,
                access: {
                    type: String,
                    enum: ["view", "edit"],
                },
            },
        ],
    },
    { timestamps: true }
);

const File = mongoose.model("File", fileSchema);
module.exports = File;
