const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

// ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// disk storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // prefix with timestamp to prevent name conflicts
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e6) + path.extname(file.originalname);
        cb(null, uniqueName);
    },
});

// file size limit: 500 MB per file
const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 },
});

module.exports = upload;
