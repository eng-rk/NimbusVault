const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middleware/authMiddleware");
const upload = require("../Middleware/uploadMiddleware");
const {
    getFiles,
    uploadFile,
    downloadFile,
    moveFileToTrash,
    renameFile,
    shareFile,
    toggleStarFile,
    lockFile,
    getTrashedFiles,
    restoreFile,
    permanentDeleteFile,
    createPublicLink,
    getPublicFileByToken
} = require("../controller/fileController");

// Unprotected public routes
router.get("/public/:token", getPublicFileByToken);

// Protected routes (require JWT)
router.use(authMiddleware);

router.get("/", getFiles);
router.post("/upload", upload.single("file"), uploadFile);
router.get("/trash", getTrashedFiles);
router.get("/:id/download", downloadFile);
router.delete("/:id", moveFileToTrash);
router.put("/:id/rename", renameFile);
router.post("/:id/share", shareFile);
router.put("/:id/star", toggleStarFile);
router.put("/:id/lock", lockFile);
router.put("/:id/restore", restoreFile);
router.delete("/:id/permanent", permanentDeleteFile);
router.post("/:id/public-link", createPublicLink);

module.exports = router;
