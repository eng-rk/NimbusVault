require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const http       = require("http");
const { Server } = require("socket.io");
const path       = require("path");
const passport   = require("passport");

const app    = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────
const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" }
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // join user's private room so we can push notifications
    socket.on("join", (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// make io accessible inside controllers
app.set("io", io);

// ── Database ─────────────────────────────────────────────────────
mongoose
    .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nimbusVault")
    .then(() => console.log("MongoDB connected successfully"))
    .catch((err) => console.log("MongoDB connection error:", err));

// ── Core Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(passport.initialize());

// serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Passport (Google OAuth) ───────────────────────────────────────
require("./Middleware/passportConfig")(passport);

// ── Routes ───────────────────────────────────────────────────────
const authRoutes     = require("./routes/authRoutes");
const fileRoutes     = require("./routes/fileRoutes");
const folderRoutes   = require("./routes/folderRoutes");
const activityRoutes = require("./routes/activityRoutes");

app.use("/api/auth",     authRoutes);
app.use("/api/files",    fileRoutes);
app.use("/api/folders",  folderRoutes);
app.use("/api/activity", activityRoutes);

// health check
app.get("/", (req, res) => {
    res.json({ msg: "NimbusVault API is running" });
});

// ── Global Error Handler ──────────────────────────────────────────
const errorMiddleware = require("./Middleware/errorMiddleware");
app.use(errorMiddleware);

// ── Start Server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`NimbusVault API running on http://localhost:${PORT}`);
});
