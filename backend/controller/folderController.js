const Folder = require("../models/Folder");
const File = require("../models/File");
const User = require("../models/User");
const Activity = require("../models/Activity");
const { createFolderSchema, updateFolderSchema, inviteFolderSchema } = require("./validation/folderValidation");
const { v4: uuidv4 } = require("uuid");

// 1. Get all folders
const getFolders = async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;

        // validation data & search
        // Find folders owned by user or shared with user
        const folders = await Folder.find({
            $or: [
                { ownerId: userId },
                { "sharedWith.userEmail": userEmail }
            ]
        }).sort({ createdAt: -1 });

        // response
        res.status(200).json({
            msg: "Folders fetched successfully",
            data: folders
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 2. Create folder
const createFolder = async (req, res) => {
    try {
        // validation data
        const { error } = createFolderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ msg: error.details[0].message });
        }

        // get data from req.body
        const { name, color, icon } = req.body;
        const userId = req.user.id;

        // create
        const newFolder = await Folder.create({
            ownerId: userId,
            name,
            color: color || "blue",
            icon: icon || "folder"
        });

        // Log activity
        await Activity.create({
            userId,
            action: "uploaded", // uploaded/created folder
            targetName: name,
            targetType: "folder",
            targetId: newFolder._id,
            actorName: req.user.userName
        });

        // response
        res.status(201).json({
            msg: "Folder created successfully",
            data: newFolder
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 3. Update folder (rename / recolor / change icon)
const updateFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const { error } = updateFolderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ msg: error.details[0].message });
        }

        const { name, color, icon } = req.body;
        const folder = await Folder.findOne({ _id: id, ownerId: userId });
        if (!folder) {
            return res.status(404).json({ msg: "Folder not found or unauthorized" });
        }

        const oldName = folder.name;

        // create/update
        if (name) folder.name = name;
        if (color) folder.color = color;
        if (icon) folder.icon = icon;
        await folder.save();

        // Log activity
        await Activity.create({
            userId,
            action: "renamed",
            targetName: name ? `${oldName} to ${name}` : folder.name,
            targetType: "folder",
            targetId: folder._id,
            actorName: req.user.userName
        });

        // response
        res.status(200).json({
            msg: "Folder updated successfully",
            data: folder
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 4. Delete folder
const deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const folder = await Folder.findOne({ _id: id, ownerId: userId });
        if (!folder) {
            return res.status(404).json({ msg: "Folder not found or unauthorized" });
        }

        // soft trash all files inside this folder
        await File.updateMany(
            { folderId: id, ownerId: userId },
            { $set: { isTrashed: true, trashedAt: Date.now() } }
        );

        // delete folder DB record
        await Folder.deleteOne({ _id: id });

        await Activity.create({
            userId,
            action: "deleted",
            targetName: folder.name,
            targetType: "folder",
            actorName: req.user.userName
        });

        // response
        res.status(200).json({
            msg: "Folder and its files moved to trash"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 5. Invite User to Folder
const inviteToFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const { error } = inviteFolderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ msg: error.details[0].message });
        }

        const { userEmail, access } = req.body;
        const folder = await Folder.findOne({ _id: id, ownerId: userId });
        if (!folder) {
            return res.status(404).json({ msg: "Folder not found or unauthorized" });
        }

        // create/update
        // Check if already invited
        const alreadySharedIdx = folder.sharedWith.findIndex(s => s.userEmail === userEmail);
        if (alreadySharedIdx > -1) {
            folder.sharedWith[alreadySharedIdx].access = access;
        } else {
            folder.sharedWith.push({ userEmail, access });
        }
        await folder.save();

        await Activity.create({
            userId,
            action: "shared",
            targetName: folder.name,
            targetType: "folder",
            targetId: folder._id,
            actorName: req.user.userName
        });

        // Realtime Websocket push notification
        const sharedUser = await User.findOne({ email: userEmail });
        if (sharedUser) {
            const io = req.app.get("io");
            if (io) {
                io.to(sharedUser._id.toString()).emit("notification", {
                    type: "folder_shared",
                    msg: `User ${req.user.userName} shared a folder with you: ${folder.name}`,
                    folderId: folder._id
                });
            }
        }

        // response
        res.status(200).json({
            msg: "Folder shared successfully",
            data: folder
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 6. Generate Folder Invite Token (Public view link)
const generateInviteToken = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // validation data
        const folder = await Folder.findOne({ _id: id, ownerId: userId });
        if (!folder) {
            return res.status(404).json({ msg: "Folder not found or unauthorized" });
        }

        // create/update
        folder.inviteToken = uuidv4();
        folder.inviteTokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
        await folder.save();

        // response
        res.status(200).json({
            msg: "Invitation link generated",
            token: folder.inviteToken,
            expiry: folder.inviteTokenExpiry
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

// 7. Get Public Folder Contents by Invite Token
const getPublicFolderByToken = async (req, res) => {
    try {
        const { token } = req.params;

        // validation data
        const folder = await Folder.findOne({
            inviteToken: token,
            inviteTokenExpiry: { $gt: Date.now() }
        });

        if (!folder) {
            return res.status(404).json({ msg: "Invitation link is invalid or expired" });
        }

        // Fetch files within this folder (non-trashed)
        const files = await File.find({ folderId: folder._id, isTrashed: false });

        // response
        res.status(200).json({
            msg: "Public folder contents fetched successfully",
            data: {
                folder: {
                    id: folder._id,
                    name: folder.name,
                    color: folder.color,
                    icon: folder.icon,
                    ownerId: folder.ownerId
                },
                files
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

module.exports = {
    getFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    inviteToFolder,
    generateInviteToken,
    getPublicFolderByToken
};
