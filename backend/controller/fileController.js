const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const Activity = require("../models/Activity");
const { renameFileSchema, shareFileSchema, lockFileSchema } = require("./validation/fileValidation");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// Helper to determine file category based on extension/mimetype
const getCategory = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["mp4", "mkv", "webm", "avi", "mov"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg", "aac", "flac"].includes(ext)) return "audio";
    if (["doc", "docx"].includes(ext)) return "word";
    if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
    if (["ppt", "pptx"].includes(ext)) return "powerpoint";
    return "other";
};

// 1. Get all files
const getFiles = async (req, res) => {
    try {
        // get data from req.body / req.query
        const { folderId, category, search, isStarred, isTrashed } = req.query;
        const userId = req.user.id;
        const userEmail = req.user.email;

        // validation data & build query
        let query = { isTrashed: isTrashed === "true" };

        // Handle folder filter
        if (folderId) {
            query.folderId = folderId;
        } else if (isTrashed !== "true") {
            // Show root level files if no folderId specified and not looking at trash
            query.folderId = null;
        }

        // Search name
        if (search) {
            query.originalName = { $regex: search, $options: "i" };
        }

        // Category filtration
        if (category && category !== "all") {
            query.category = category;
        }

        // Starred files
        if (isStarred === "true") {
            query.isStarred = true;
        }

        // Authorization: files owned by user OR shared with user
        // If query is specifically for root files (folderId: null), fetch files owned or shared
        if (!folderId) {
            query.$or = [
                { ownerId: userId },
                { "sharedWith.userEmail": userEmail }
            ];
        } else {
            // If viewing folder contents, verify accessibility of folder first
            const folder = await Folder.findById(folderId);
            if (!folder) {
                return res.status(404).json({ msg: "Folder not found" });
            }
            const isOwner = folder.ownerId.toString() === userId;
            const isShared = folder.sharedWith.some(s => s.userEmail === userEmail);
            if (!isOwner && !isShared) {
                return res.status(403).json({ msg: "Access denied to folder contents" });
            }
            // If they have access, fetch all files in that folder
            // (Files uploaded inside this folder are accessible)
        }

        // create / fetch
        const files = await File.find(query).sort({ createdAt: -1 });

        // response
        res.status(200).json({
            msg: "Files fetched successfully",
            data: files
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 2. Upload file
const uploadFile = async (req, res) => {
    try {
        // validation data
        if (!req.file) {
            return res.status(400).json({ msg: "No file uploaded" });
        }

        // get data from req.body
        const { folderId, chargeToOwner } = req.body;
        const userId = req.user.id;
        const userName = req.user.userName;

        const fileSize = req.file.size;
        const mimeType = req.file.mimetype;
        const originalName = req.file.originalname;
        const storedName = req.file.filename;

        let chargeUserId = userId;
        // Storage deduction check
        if (folderId && folderId !== "null" && folderId !== "undefined") {
            const folder = await Folder.findById(folderId);
            if (folder) {
                if (chargeToOwner === "true" || chargeToOwner === true) {
                    chargeUserId = folder.ownerId;
                }
            }
        }

        // Get charging user storage usage
        const chargingUser = await User.findById(chargeUserId);
        if (!chargingUser) {
            // remove uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ msg: "Storage charging account not found" });
        }

        // Determine storage limit (15 GB for Free, 100 GB for Premium)
        const isSubscribed = chargingUser.isSubscribed;
        const limitBytes = isSubscribed ? 107374182400 : 16106127360;
        const limitText = isSubscribed ? "100 GB" : "15 GB";

        if (chargingUser.storageUsed + fileSize > limitBytes) {
            // remove uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ msg: `Storage Limit Exceeded (${limitText} max)` });
        }

        // create
        // Update user storage
        chargingUser.storageUsed += fileSize;
        await chargingUser.save();

        const fileCategory = getCategory(originalName);

        const newFile = await File.create({
            ownerId: userId,
            folderId: (folderId && folderId !== "null" && folderId !== "undefined") ? folderId : null,
            originalName,
            storedName,
            mimeType,
            size: fileSize,
            category: fileCategory,
            chargedTo: chargeUserId,
            permission: "private"
        });

        // Log activity
        await Activity.create({
            userId,
            action: "uploaded",
            targetName: originalName,
            targetType: "file",
            targetId: newFile._id,
            actorName: userName
        });

        // Realtime WebSockets push notification & upload progress success
        const io = req.app.get("io");
        if (io) {
            io.to(userId).emit("notification", {
                type: "upload_success",
                msg: `File ${originalName} uploaded successfully.`,
                file: newFile
            });
            // If chargedTo is different, notify folder owner
            if (chargeUserId.toString() !== userId) {
                io.to(chargeUserId.toString()).emit("notification", {
                    type: "storage_deduction",
                    msg: `Storage deducted for file uploaded by ${userName}: ${originalName}`
                });
            }
        }

        // response
        res.status(201).json({
            msg: "File uploaded successfully",
            data: newFile
        });
    } catch (error) {
        console.log(error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ msg: "Server error" });
    }
};

// 3. Download file
const downloadFile = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.query;

        // validation data
        const file = await File.findById(id);
        if (!file) {
            return res.status(404).json({ msg: "File not found" });
        }

        if (file.isTrashed) {
            return res.status(400).json({ msg: "Cannot download trashed file" });
        }

        // Check password lock
        if (file.passwordLock) {
            if (!password) {
                return res.status(403).json({ msg: "File is locked. Password required.", locked: true });
            }
            const match = await bcrypt.compare(password, file.passwordLock);
            if (!match) {
                return res.status(403).json({ msg: "Invalid password for locked file", locked: true });
            }
        }

        // locate file
        const filePath = path.join(__dirname, "../uploads", file.storedName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ msg: "Physical file not found on server" });
        }

        // Log activity
        await Activity.create({
            userId: req.user.id,
            action: "downloaded",
            targetName: file.originalName,
            targetType: "file",
            targetId: file._id,
            actorName: req.user.userName
        });

        // response
        res.download(filePath, file.originalName);
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 4. Move to trash
const moveFileToTrash = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const file = await File.findOne({ _id: id, ownerId: userId });
        if (!file) {
            return res.status(404).json({ msg: "File not found or unauthorized" });
        }

        // create/update
        file.isTrashed = true;
        file.trashedAt = Date.now();
        await file.save();

        await Activity.create({
            userId,
            action: "moved_to_trash",
            targetName: file.originalName,
            targetType: "file",
            targetId: file._id,
            actorName: req.user.userName
        });

        // response
        res.status(200).json({
            msg: "File moved to trash",
            data: file
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 5. Rename file
const renameFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const { error } = renameFileSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ msg: error.details[0].message });
        }

        const { originalName } = req.body;
        const file = await File.findOne({ _id: id, ownerId: userId });
        if (!file) {
            return res.status(404).json({ msg: "File not found or unauthorized" });
        }

        const oldName = file.originalName;

        // create/update
        file.originalName = originalName;
        file.category = getCategory(originalName);
        await file.save();

        await Activity.create({
            userId,
            action: "renamed",
            targetName: `${oldName} to ${originalName}`,
            targetType: "file",
            targetId: file._id,
            actorName: req.user.userName
        });

        // response
        res.status(200).json({
            msg: "File renamed successfully",
            data: file
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 6. Share file
const shareFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const { error } = shareFileSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ msg: error.details[0].message });
        }

        const { userEmail, access } = req.body;
        const file = await File.findOne({ _id: id, ownerId: userId });
        if (!file) {
            return res.status(404).json({ msg: "File not found or unauthorized" });
        }

        // create/update
        // Check if already shared with user
        const alreadySharedIdx = file.sharedWith.findIndex(s => s.userEmail === userEmail);
        if (alreadySharedIdx > -1) {
            file.sharedWith[alreadySharedIdx].access = access;
        } else {
            file.sharedWith.push({ userEmail, access });
        }
        await file.save();

        await Activity.create({
            userId,
            action: "shared",
            targetName: file.originalName,
            targetType: "file",
            targetId: file._id,
            actorName: req.user.userName
        });

        // Realtime WebSockets push notification to shared user if online
        const sharedUser = await User.findOne({ email: userEmail });
        if (sharedUser) {
            const io = req.app.get("io");
            if (io) {
                io.to(sharedUser._id.toString()).emit("notification", {
                    type: "file_shared",
                    msg: `User ${req.user.userName} shared a file with you: ${file.originalName}`,
                    fileId: file._id
                });
            }
        }

        // response
        res.status(200).json({
            msg: "File shared successfully",
            data: file
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 7. Toggle star
const toggleStarFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const file = await File.findOne({ _id: id, ownerId: userId });
        if (!file) {
            return res.status(404).json({ msg: "File not found or unauthorized" });
        }

        // create/update
        file.isStarred = !file.isStarred;
        await file.save();

        await Activity.create({
            userId,
            action: file.isStarred ? "starred" : "unstarred",
            targetName: file.originalName,
            targetType: "file",
            targetId: file._id,
            actorName: req.user.userName
        });

        // response
        res.status(200).json({
            msg: file.isStarred ? "File starred" : "File unstarred",
            data: file
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 8. Lock/Unlock file
const lockFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const { error } = lockFileSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ msg: error.details[0].message });
        }

        const { password } = req.body;
        const file = await File.findOne({ _id: id, ownerId: userId });
        if (!file) {
            return res.status(404).json({ msg: "File not found or unauthorized" });
        }

        // create/update
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            file.passwordLock = hash;
        } else {
            file.passwordLock = null;
        }
        await file.save();

        await Activity.create({
            userId,
            action: password ? "locked" : "restored", // lock activity
            targetName: file.originalName,
            targetType: "file",
            targetId: file._id,
            actorName: req.user.userName
        });

        // response
        res.status(200).json({
            msg: password ? "File locked successfully" : "File unlocked successfully",
            data: { id: file._id, isLocked: !!file.passwordLock }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 9. Get trash
const getTrashedFiles = async (req, res) => {
    try {
        const userId = req.user.id;

        // fetch
        const files = await File.find({ ownerId: userId, isTrashed: true }).sort({ trashedAt: -1 });

        // response
        res.status(200).json({
            msg: "Trashed files fetched successfully",
            data: files
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 10. Restore file
const restoreFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const file = await File.findOne({ _id: id, ownerId: userId });
        if (!file) {
            return res.status(404).json({ msg: "File not found or unauthorized" });
        }

        // create/update
        file.isTrashed = false;
        file.trashedAt = null;
        await file.save();

        await Activity.create({
            userId,
            action: "restored",
            targetName: file.originalName,
            targetType: "file",
            targetId: file._id,
            actorName: req.user.userName
        });

        // response
        res.status(200).json({
            msg: "File restored successfully",
            data: file
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 11. Permanent delete
const permanentDeleteFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const file = await File.findOne({ _id: id, ownerId: userId });
        if (!file) {
            return res.status(404).json({ msg: "File not found or unauthorized" });
        }

        // subtract from user storage
        const chargingUser = await User.findById(file.chargedTo);
        if (chargingUser) {
            chargingUser.storageUsed = Math.max(0, chargingUser.storageUsed - file.size);
            await chargingUser.save();
        }

        // delete physically
        const filePath = path.join(__dirname, "../uploads", file.storedName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // delete DB record
        await File.deleteOne({ _id: id });

        await Activity.create({
            userId,
            action: "deleted",
            targetName: file.originalName,
            targetType: "file",
            actorName: req.user.userName
        });

        // response
        res.status(200).json({
            msg: "File permanently deleted"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 12. Public Link Generator
const createPublicLink = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const file = await File.findOne({ _id: id, ownerId: userId });
        if (!file) {
            return res.status(404).json({ msg: "File not found or unauthorized" });
        }

        // create/update
        file.publicToken = uuidv4();
        file.publicTokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
        file.permission = "public";
        await file.save();

        // response
        res.status(200).json({
            msg: "Public link created",
            token: file.publicToken,
            expiry: file.publicTokenExpiry
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 13. Public get file by token
const getPublicFileByToken = async (req, res) => {
    try {
        const { token } = req.params;

        // validation data
        const file = await File.findOne({
            publicToken: token,
            publicTokenExpiry: { $gt: Date.now() }
        });

        if (!file) {
            return res.status(404).json({ msg: "Public link is invalid or expired" });
        }

        const filePath = path.join(__dirname, "../uploads", file.storedName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ msg: "File not found on server" });
        }

        // response
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
        res.setHeader("Content-Type", file.mimeType);
        res.sendFile(filePath);
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

module.exports = {
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
};
