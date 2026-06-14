const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");

const File = require("../models/File");

const router = express.Router();

const STORAGE_LIMIT = 15 * 1024 * 1024 * 1024; // 15 GB

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),

  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${nanoid()}-${file.originalname}`),
});

const upload = multer({ storage });

// 🔥 Helper: تحديد النوع
function getCategory(mimetype, name) {
  const ext = path.extname(name).toLowerCase();

  if (mimetype.includes("pdf") || ext === ".pdf") return "pdf";

  if (ext === ".doc" || ext === ".docx" || mimetype.includes("word"))
    return "word";

  if (ext === ".xls" || ext === ".xlsx" || mimetype.includes("sheet"))
    return "excel";

  if (mimetype.startsWith("image/")) return "image";

  if (mimetype.startsWith("video/")) return "video";

  if (mimetype.startsWith("audio/")) return "audio";

  return "other";
}

// ========================
// GET FILES
// ========================
router.get("/", async (req, res) => {
  try {
    const { folderId, category, search } = req.query;

    let query = {
      ownerId: req.user.id,
    };

    if (folderId) query.folderId = folderId;
    if (category) query.category = category;

    let files = await File.find(query);

    if (search) {
      files = files.filter((f) =>
        f.originalName.toLowerCase().includes(search.toLowerCase()),
      );
    }

    res.json({ files });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// ========================
// UPLOAD FILE
// ========================
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "File is required",
      });
    }

    const files = await File.find({ ownerId: req.user.id });
    const currentUsage = files.reduce((sum, f) => sum + f.size, 0);

    if (currentUsage + req.file.size > STORAGE_LIMIT) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: "Storage limit of 15 GB exceeded",
      });
    }

    const category = getCategory(req.file.mimetype, req.file.originalname);

    const file = await File.create({
      ownerId: req.user.id,
      folderId: req.body.folderId || null,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      permission: req.body.permission || "private",
      category, // ⭐ الجديد
    });

    res.status(201).json({ file });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// ========================
// DOWNLOAD
// ========================
router.get("/:id/download", async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!file)
      return res.status(404).json({
        message: "File not found",
      });

    const filePath = path.join(uploadDir, file.storedName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "Stored file missing",
      });
    }

    res.download(filePath, file.originalName);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// ========================
// RENAME
// ========================
router.put("/:id/rename", async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!file)
      return res.status(404).json({
        message: "File not found",
      });

    file.originalName = req.body.name;

    await file.save();

    res.json({ file });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// ========================
// MOVE
// ========================
router.put("/:id/move", async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!file)
      return res.status(404).json({
        message: "File not found",
      });

    file.folderId = req.body.folderId || null;

    await file.save();

    res.json({ file });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// ========================
// DELETE
// ========================
router.delete("/:id", async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!file)
      return res.status(404).json({
        message: "File not found",
      });

    const filePath = path.join(uploadDir, file.storedName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await file.deleteOne();

    res.json({
      message: "File deleted",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;
