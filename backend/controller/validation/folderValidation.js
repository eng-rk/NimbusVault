const joi = require("joi");

const createFolderSchema = joi.object({
    name: joi.string().min(1).max(100).required(),
    color: joi.string().valid("blue", "purple", "green", "orange", "red", "pink", "cyan", "yellow").default("blue"),
    icon: joi.string().default("folder")
});

const updateFolderSchema = joi.object({
    name: joi.string().min(1).max(100),
    color: joi.string().valid("blue", "purple", "green", "orange", "red", "pink", "cyan", "yellow"),
    icon: joi.string()
});

const inviteFolderSchema = joi.object({
    userEmail: joi.string().email().required(),
    access: joi.string().valid("view", "upload").required()
});

module.exports = {
    createFolderSchema,
    updateFolderSchema,
    inviteFolderSchema
};
