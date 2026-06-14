const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },

    originalName: String,
    storedName: String,
    mimeType: String,
    size: Number,

    category: {
      type: String,
      enum: ["pdf", "word", "excel", "image", "video", "audio", "other"],
      default: "other",
    },

    permission: {
      type: String,
      enum: ["private", "public"],
      default: "private",
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
  { timestamps: true },
);

module.exports = mongoose.model("File", fileSchema);
