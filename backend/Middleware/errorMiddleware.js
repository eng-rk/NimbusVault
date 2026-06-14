// error handling middleware
const errorMiddleware = (err, req, res, next) => {
    console.error(err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ msg: message });
};

module.exports = errorMiddleware;
