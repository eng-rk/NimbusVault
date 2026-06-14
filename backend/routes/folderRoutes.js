const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middleware/authMiddleware");
const {
    getFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    inviteToFolder,
    generateInviteToken,
    getPublicFolderByToken
} = require("../controller/folderController");

// Unprotected guest view
router.get("/invite/:token", getPublicFolderByToken);

// Protected routes (require JWT)
router.use(authMiddleware);

router.get("/", getFolders);
router.post("/", createFolder);
router.put("/:id", updateFolder);
router.delete("/:id", deleteFolder);
router.post("/:id/invite", inviteToFolder);
router.post("/:id/invite-link", generateInviteToken);

module.exports = router;
