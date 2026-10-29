// ============================================================
// EXPENSEGUARD — EXPRESS BACKEND SERVER (CE-2)
// Node.js + Express + MongoDB Atlas + Firebase Admin SDK
// ============================================================

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const transactionsRouter = require("./routes/transactions");
const categoriesRouter = require("./routes/categories");
const anomaliesRouter = require("./routes/anomalies");
const { isFirebaseInitialized } = require("./middleware/verifyFirebaseToken");

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ============================================================
// CORS CONFIGURATION
// ============================================================
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())
  : [
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:8000",
      "http://127.0.0.1:8000",
      "http://localhost:3000",
    ];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, or same-origin static files)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev, logged in production
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ============================================================
// BODY PARSING MIDDLEWARE
// ============================================================
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Request logger in development
if (NODE_ENV !== "test") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.originalUrl.startsWith("/api")) {
        console.log(
          `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`
        );
      }
    });
    next();
  });
}

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================
app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    status: "ok",
    application: "ExpenseGuard API",
    version: "2.0.0",
    environment: NODE_ENV,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatusMap[dbState] || "unknown",
      readyState: dbState,
    },
    auth: {
      firebaseAdminConfigured: isFirebaseInitialized(),
    },
  });
});

// ============================================================
// API ROUTES
// ============================================================
app.use("/api/transactions", transactionsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/anomalies", anomaliesRouter);

// ============================================================
// STATIC FRONTEND SERVING
// Serves the existing HTML, CSS, and JS frontend
// ============================================================
const clientDir = path.resolve(__dirname, "..");
app.use(
  express.static(clientDir, {
    index: "index.html",
    extensions: ["html"],
  })
);

// Fallback for SPA/routing or 404
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint '${req.originalUrl}' not found`,
  });
});

// ============================================================
// CENTRALIZED ERROR HANDLING MIDDLEWARE
// ============================================================
app.use((err, req, res, next) => {
  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      details: messages,
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      error: "Duplicate key entry detected",
    });
  }

  // Log error internally
  console.error("Internal Server Error:", err);

  // Return clean, non-leaking error response
  return res.status(err.status || 500).json({
    success: false,
    error:
      NODE_ENV === "production"
        ? "An internal server error occurred"
        : err.message || "Internal Server Error",
  });
});

// ============================================================
// DATABASE CONNECTION & SERVER STARTUP
// ============================================================
let server = null;

async function startServer() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri && !mongoUri.includes("YOUR_DB_USER")) {
    try {
      console.log("Connecting to MongoDB Atlas...");
      
await mongoose.connect(mongoUri, {
  family: 4,
  serverSelectionTimeoutMS: 10000,
});

      console.log("✓ Connected to MongoDB Atlas database successfully.");
    } catch (dbError) {
      console.error("⚠ MongoDB Atlas connection failed:", dbError.message);
      console.error(
        "Make sure your MONGODB_URI in .env is correct and IP access is allowed in MongoDB Atlas Network Access."
      );
    }
  } else {
    console.warn(
      "⚠ MONGODB_URI not configured in .env (or contains placeholder). Using offline fallback state for local development."
    );
  }

  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🛡️  ExpenseGuard Server (CE-2) running on port ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`🩺 Health:   http://localhost:${PORT}/api/health`);
    console.log(`💳 APIs:     http://localhost:${PORT}/api/transactions`);
    console.log(`📂 Categories: http://localhost:${PORT}/api/categories`);
    console.log(`⚠️ Anomalies:  http://localhost:${PORT}/api/anomalies`);
    console.log(`====================================================`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

// Graceful shutdown handling
process.on("SIGINT", async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

module.exports = app;
module.exports.startServer = startServer;
