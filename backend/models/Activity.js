// require mongoose
// create schema
// create model
// export
const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        action: {
            type: String,
            enum: [
                "uploaded",
                "downloaded",
                "deleted",
                "restored",
                "renamed",
                "shared",
                "starred",
                "unstarred",
                "locked",
                "moved_to_trash",
            ],
            required: true,
        },
        targetName: {
            type: String,
            required: true,
        },
        targetType: {
            type: String,
            enum: ["file", "folder"],
            default: "file",
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        actorName: {
            type: String,
            default: "You",
        },
    },
    { timestamps: true }
);

const Activity = mongoose.model("Activity", activitySchema);
module.exports = Activity;
