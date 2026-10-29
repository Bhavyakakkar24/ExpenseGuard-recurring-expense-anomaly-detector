const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

let firebaseInitialized = false;

function initializeFirebaseAdmin() {
  if (firebaseInitialized) return true;
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }

  try {
    // Option 1: File path from env or default server/config/serviceAccountKey.json
    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, "../config/serviceAccountKey.json");

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, "utf8")
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log("✓ Firebase Admin SDK initialized from service account file.");
      return true;
    }

    // Option 2: Inline JSON in environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log("✓ Firebase Admin SDK initialized from env JSON.");
      return true;
    }

    // Option 3: Separate environment variables
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
      firebaseInitialized = true;
      console.log("✓ Firebase Admin SDK initialized from env credentials.");
      return true;
    }

    // Fallback: Default application credentials (GCP / Firebase environment)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      firebaseInitialized = true;
      console.log("✓ Firebase Admin SDK initialized via application default.");
      return true;
    }

    console.warn(
      "⚠ Warning: Firebase Admin credentials not found. Protected endpoints will reject tokens until configured in .env or server/config/serviceAccountKey.json."
    );
    return false;
  } catch (error) {
    console.error("Firebase Admin initialization error:", error.message);
    return false;
  }
}

// Call on load
initializeFirebaseAdmin();

/**
 * Express middleware to verify Firebase ID tokens
 */
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Missing or malformed Authorization header.",
    });
  }

  const token = authHeader.split("Bearer ")[1].trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Bearer token is empty.",
    });
  }

  // Support for automated test suite running with NODE_ENV='test'
  if (process.env.NODE_ENV === "test") {
    if (token.startsWith("test-token-")) {
      const uid = token.replace("test-token-", "");
      req.user = {
        uid: uid,
        email: `${uid}@example.com`,
        name: `Test User ${uid}`,
      };
      return next();
    }
  }

  if (!firebaseInitialized) {
    const initializedNow = initializeFirebaseAdmin();
    if (!initializedNow) {
      return res.status(401).json({
        success: false,
        error:
          "Firebase Admin SDK is not configured on the server. Please configure credentials in .env.",
      });
    }
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      name: decodedToken.name || decodedToken.display_name || "",
      picture: decodedToken.picture || "",
    };
    next();
  } catch (error) {
    console.error("Token verification failed:", error.code || error.message);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authentication token. Please sign in again.",
      code: error.code || "auth/invalid-token",
    });
  }
}

module.exports = {
  verifyFirebaseToken,
  initializeFirebaseAdmin,
  isFirebaseInitialized: () => firebaseInitialized,
};
