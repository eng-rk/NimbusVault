const jwt = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
    try {
        // get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ msg: "Token Not Found" });
        }

        // extract Bearer token
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({ msg: "Token Not Found" });
        }

        // verify token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        // attach user to request
        req.user = decodedToken;

        next();
    } catch (error) {
        return res.status(401).json({ msg: "Invalid or Expired Token" });
    }
};

module.exports = authMiddleware;
