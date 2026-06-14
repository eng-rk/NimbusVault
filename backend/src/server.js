require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./utils/db");

const auth = require("./middleware/auth");
const authRoutes = require("./routes/auth.routes");
const folderRoutes = require("./routes/folder.routes");
const fileRoutes = require("./routes/file.routes");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json());

// Test Route
app.get("/", (req, res) => {
  res.json({
    message: "Mini Drive API is running",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/folders", auth, folderRoutes);
app.use("/api/files", auth, fileRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    message: "Server error",
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(
    `Mini Drive API running on http://localhost:${PORT}`
  );
});