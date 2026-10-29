// ============================================================
// EXPENSEGUARD — FIREBASE AUTHENTICATION MODULE (CE-2)
// Uses Firebase Modular Web SDK (v10) with Google Sign-In
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ============================================================
// 1. FIREBASE CONFIGURATION
// Replace these placeholders with your actual Firebase Web App credentials
// Obtained from: Firebase Console -> Project Settings -> General -> Your apps -> Web app
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBAE0qJOKmATd-lIxXwem_RpJzRVo-iM68",
  authDomain: "expenseguard-25.firebaseapp.com",
  projectId: "expenseguard-25",
  storageBucket: "expenseguard-25.firebasestorage.app",
  messagingSenderId: "306379271607",
  appId: "1:306379271607:web:fc2f0ff467184fb02c0c32",
  measurementId: "G-2X9ZYDXTS7"
};

// Check if credentials are still placeholder
const isConfigured =
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes("YOUR_FIREBASE") &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes("YOUR_FIREBASE");

let app = null;
let auth = null;
let googleProvider = null;
let authStateResolved = false;
let currentAuthUser = null;
const authListeners = [];

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });

    // Ensure session persists across browser tabs & reloads
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Could not set local auth persistence:", err.message);
    });

    onAuthStateChanged(auth, (user) => {
      currentAuthUser = user;
      authStateResolved = true;

      if (user) {
        // Synchronize display data for UI rendering
        const userData = {
          uid: user.uid,
          name: user.displayName || user.email.split("@")[0],
          email: user.email,
          photoURL: user.photoURL || "",
        };
        localStorage.setItem("expenseGuardCurrentUser", JSON.stringify(userData));
        localStorage.setItem("expenseGuardLoggedIn", "true");

        // Prime transactions from MongoDB Atlas for the authenticated user
        if (typeof window.fetchTransactions === "function") {
          window.fetchTransactions(true).then(() => {
            if (typeof updateDashboard === "function") updateDashboard();
            if (typeof renderTransactions === "function") renderTransactions();
            if (typeof window.renderAnomalies === "function") window.renderAnomalies();
            if (typeof window.renderCategories === "function") window.renderCategories();
            if (typeof window.renderBudgets === "function") window.renderBudgets();
            if (typeof window.renderReports === "function") window.renderReports();
          }).catch(() => {});
        }
      } else {
        localStorage.removeItem("expenseGuardCurrentUser");
        localStorage.removeItem("expenseGuardLoggedIn");
      }

      // Notify all registered callbacks
      authListeners.forEach((cb) => {
        try {
          cb(user);
        } catch (e) {
          console.error("Auth listener error:", e);
        }
      });
    });
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
} else {
  // Graceful state when placeholders are present
  console.warn(
    "⚠ ExpenseGuard: Firebase credentials not yet configured. Please set your credentials in 'javascript/firebase-auth.js'."
  );
  authStateResolved = true;
}

// ============================================================
// PUBLIC AUTHENTICATION API
// ============================================================
const ExpenseGuardAuth = {
  isConfigured() {
    return isConfigured;
  },

  getCurrentUser() {
    return currentAuthUser;
  },

  isAuthStateResolved() {
    return authStateResolved;
  },

  /**
   * Returns a promise that resolves once the initial auth check completes
   */
  waitForAuth() {
    if (authStateResolved) return Promise.resolve(currentAuthUser);
    return new Promise((resolve) => {
      const unsubscribe = this.onAuthStateChange((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  },

  /**
   * Retrieves fresh Firebase ID token for Authorization header
   */
  async getIdToken(forceRefresh = false) {
    if (!authStateResolved) {
      await this.waitForAuth();
    }
    if (currentAuthUser && typeof currentAuthUser.getIdToken === "function") {
      try {
        return await currentAuthUser.getIdToken(forceRefresh);
      } catch (err) {
        console.error("Failed to retrieve fresh Firebase ID token:", err);
        return null;
      }
    }
    // Return null if not signed in or not configured
    return null;
  },

  /**
   * Trigger Google Sign-In Popup
   */
  async signInWithGoogle() {
    if (!isConfigured) {
      return {
        success: false,
        error:
          "Firebase is not configured yet. Please open 'javascript/firebase-auth.js' and insert your Firebase Web App configuration from Firebase Console.",
        code: "auth/not-configured",
      };
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const token = await user.getIdToken();

      const profile = {
        uid: user.uid,
        name: user.displayName || user.email.split("@")[0],
        email: user.email,
        photoURL: user.photoURL || "",
      };

      localStorage.setItem("expenseGuardCurrentUser", JSON.stringify(profile));
      localStorage.setItem("expenseGuardLoggedIn", "true");

      return {
        success: true,
        user: profile,
        token: token,
      };
    } catch (error) {
      console.error("Google sign-in error:", error);

      let friendlyMessage = "Sign in failed. Please try again.";

      switch (error.code) {
        case "auth/popup-closed-by-user":
          friendlyMessage = "Sign in was cancelled. The Google popup was closed.";
          break;
        case "auth/popup-blocked":
          friendlyMessage = "Popup blocked by browser. Please allow popups for this site.";
          break;
        case "auth/cancelled-popup-request":
          friendlyMessage = "Another sign-in popup is already open.";
          break;
        case "auth/unauthorized-domain":
          friendlyMessage =
            "This domain is not authorized in Firebase Console. Go to Authentication → Settings → Authorized Domains and add your domain (e.g., localhost).";
          break;
        case "auth/network-request-failed":
          friendlyMessage = "Network error. Please check your internet connection.";
          break;
        case "auth/operation-not-allowed":
          friendlyMessage =
            "Google sign-in provider is not enabled in Firebase Console. Enable it under Authentication → Sign-in method.";
          break;
        default:
          friendlyMessage = error.message || friendlyMessage;
      }

      return {
        success: false,
        error: friendlyMessage,
        code: error.code,
      };
    }
  },

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("SignOut warning:", e);
    } finally {
      currentAuthUser = null;
      localStorage.removeItem("expenseGuardCurrentUser");
      localStorage.removeItem("expenseGuardLoggedIn");
      sessionStorage.clear();
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback) {
    if (typeof callback !== "function") return () => {};
    authListeners.push(callback);

    if (authStateResolved) {
      callback(currentAuthUser);
    }

    return () => {
      const idx = authListeners.indexOf(callback);
      if (idx !== -1) authListeners.splice(idx, 1);
    };
  },
};

// Expose globally for existing vanilla JS modules
window.ExpenseGuardAuth = ExpenseGuardAuth;
export default ExpenseGuardAuth;
