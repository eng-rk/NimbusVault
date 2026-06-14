const joi = require("joi");

const registerSchema = joi.object({
    userName: joi.string().min(3).max(50).required(),
    email: joi.string().email().required(),
    password: joi.string().min(6).required(),
    role: joi.string().valid("admin", "user").default("user")
});

const loginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(6).required()
});

module.exports = {
    registerSchema,
    loginSchema
};
