const express = require("express");

const Folder = require("../models/Folder");
const File = require("../models/File");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const folders = await Folder.find({
      ownerId: req.user.id,
    });

    res.json({ folders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Folder name is required" });
    }

    const folder = await Folder.create({
      name,
      ownerId: req.user.id,
    });

    res.status(201).json({ folder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;

    const folder = await Folder.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    folder.name = name;
    await folder.save();

    res.json({ folder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    await File.updateMany({ folderId: folder._id }, { folderId: null });

    await folder.deleteOne();

    res.json({
      message: "Folder deleted",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
