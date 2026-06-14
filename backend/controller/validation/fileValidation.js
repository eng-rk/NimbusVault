const joi = require("joi");

const renameFileSchema = joi.object({
    originalName: joi.string().min(1).max(255).required()
});

const shareFileSchema = joi.object({
    userEmail: joi.string().email().required(),
    access: joi.string().valid("view", "edit").required()
});

const lockFileSchema = joi.object({
    password: joi.string().min(4).allow(null, "").required()
});

module.exports = {
    renameFileSchema,
    shareFileSchema,
    lockFileSchema
};
