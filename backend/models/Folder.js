// require mongoose
// create schema
// create model
// export
const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        color: {
            type: String,
            enum: ["blue", "purple", "green", "orange", "red", "pink", "cyan", "yellow"],
            default: "blue",
        },
        icon: {
            type: String,
            default: "folder",
        },
        isStarred: {
            type: Boolean,
            default: false,
        },
        // token for folder invitation link
        inviteToken: {
            type: String,
            default: null,
        },
        inviteTokenExpiry: {
            type: Date,
            default: null,
        },
        sharedWith: [
            {
                userEmail: String,
                access: {
                    type: String,
                    enum: ["view", "upload"],
                },
            },
        ],
    },
    { timestamps: true }
);

const Folder = mongoose.model("Folder", folderSchema);
module.exports = Folder;
