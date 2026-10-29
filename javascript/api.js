// ============================================================
// EXPENSEGUARD — API CLIENT MODULE (CE-2)
// Handles authenticated REST requests to Express backend & MongoDB Atlas
// ============================================================

(function () {
  "use strict";

  // Base URL: relative if served on port 5000, otherwise http://localhost:5000
  const API_BASE_URL =
    window.location.port === "5000"
      ? ""
      : (window.EXPENSEGUARD_API_URL || "http://localhost:5000");

  let eventSource = null;
  let sseListeners = [];

  /**
   * Helper to retrieve Authorization header with Firebase token
   */
  async function getAuthHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    if (window.ExpenseGuardAuth && typeof window.ExpenseGuardAuth.getIdToken === "function") {
      const token = await window.ExpenseGuardAuth.getIdToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Safe fetch wrapper with error handling and JSON parsing
   */
  async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await getAuthHeaders();

    const config = {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    };

    try {
      const response = await fetch(url, config);
      let data = null;

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { text };
        }
      }

      if (!response.ok) {
        const errorMessage =
          data?.error ||
          data?.message ||
          `Request failed with status ${response.status} (${response.statusText})`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (networkError) {
      if (networkError.status) {
        throw networkError;
      }
      console.error(`API Network Error [${options.method || "GET"} ${endpoint}]:`, networkError);
      const customError = new Error(
        "Could not connect to ExpenseGuard backend server. Please ensure the server is running on http://localhost:5000."
      );
      customError.isNetworkError = true;
      throw customError;
    }
  }

  // ============================================================
  // PUBLIC API INTERFACE
  // ============================================================
  const ExpenseGuardAPI = {
    baseUrl: API_BASE_URL,

    /**
     * Check backend health and DB connection
     */
    async checkHealth() {
      try {
        return await request("/api/health", { method: "GET" });
      } catch (err) {
        return { status: "error", error: err.message };
      }
    },

    /**
     * Fetch all transactions for current authenticated user
     */
    async getTransactions() {
      const result = await request("/api/transactions", { method: "GET" });
      return result.data || [];
    },

    /**
     * Fetch all saved anomalies for current authenticated user from MongoDB Atlas
     */
    async getAnomalies(filters = {}) {
      let endpoint = "/api/anomalies";
      const params = new URLSearchParams();
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      if (filters.severity && filters.severity !== "all") params.append("severity", filters.severity);
      if (params.toString()) endpoint += `?${params.toString()}`;

      try {
        const result = await request(endpoint, { method: "GET" });
        return result.data || [];
      } catch (err) {
        // Fallback to transaction anomalies if needed
        const fallback = await request("/api/transactions/anomalies", { method: "GET" });
        return fallback.data || [];
      }
    },

    /**
     * Trigger server-side anomaly detection & synchronization to MongoDB Atlas
     */
    async detectAnomalies() {
      const result = await request("/api/anomalies/detect", { method: "POST" });
      return result.data || [];
    },

    /**
     * Update an anomaly's review status (new, reviewed, dismissed) in MongoDB Atlas
     */
    async updateAnomalyStatus(id, status) {
      const result = await request(`/api/anomalies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      return result.data;
    },

    /**
     * Dismiss / delete an anomaly document from MongoDB Atlas
     */
    async deleteAnomaly(id) {
      return await request(`/api/anomalies/${id}`, {
        method: "DELETE",
      });
    },

    /**
     * Create a new transaction in MongoDB Atlas
     */
    async createTransaction(transactionData) {
      const result = await request("/api/transactions", {
        method: "POST",
        body: JSON.stringify(transactionData),
      });
      return result.data;
    },

    /**
     * Update an owned transaction
     */
    async updateTransaction(id, updates) {
      const result = await request(`/api/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      return result.data;
    },

    /**
     * Delete an owned transaction
     */
    async deleteTransaction(id) {
      return await request(`/api/transactions/${id}`, {
        method: "DELETE",
      });
    },

    /**
     * Import multiple transactions in bulk (e.g. from CSV or LocalStorage migration)
     */
    async importTransactions(items) {
      return await request("/api/transactions/batch", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
    },

    /**
     * Fetch all saved categories for current authenticated user from MongoDB Atlas
     */
    async getCategories() {
      const result = await request("/api/categories", { method: "GET" });
      return result.data || [];
    },

    /**
     * Create a new category in MongoDB Atlas
     */
    async createCategory(categoryData) {
      const result = await request("/api/categories", {
        method: "POST",
        body: JSON.stringify(categoryData),
      });
      return result.data;
    },

    /**
     * Update an owned category in MongoDB Atlas
     */
    async updateCategory(id, updates) {
      const result = await request(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      return result.data;
    },

    /**
     * Delete an owned category from MongoDB Atlas (does not delete transactions)
     */
    async deleteCategory(id) {
      return await request(`/api/categories/${id}`, {
        method: "DELETE",
      });
    },

    /**
     * Safely and idempotently initialize categories from user's existing transactions
     */
    async initCategories() {
      return await request("/api/categories/init", {
        method: "POST",
      });
    },

    /**
     * Synchronize missing category documents from existing transactions
     */
    async syncCategories() {
      return await request("/api/categories/sync", {
        method: "POST",
      });
    },

    /**
     * Subscribe to real-time transaction updates (Server-Sent Events)
     */
    async subscribeRealtime(callback) {
      if (typeof callback !== "function") return () => {};
      sseListeners.push(callback);

      if (eventSource) {
        return () => {
          const idx = sseListeners.indexOf(callback);
          if (idx !== -1) sseListeners.splice(idx, 1);
        };
      }

      let token = null;
      if (window.ExpenseGuardAuth && typeof window.ExpenseGuardAuth.getIdToken === "function") {
        token = await window.ExpenseGuardAuth.getIdToken();
      }

      if (!token) {
        // Can't subscribe without auth token
        return () => {};
      }

      try {
        const streamUrl = `${API_BASE_URL}/api/transactions/stream?token=${encodeURIComponent(token)}`;
        eventSource = new EventSource(streamUrl);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            sseListeners.forEach((fn) => {
              try {
                fn(data);
              } catch (e) {
                console.error("SSE listener error:", e);
              }
            });
          } catch (e) {}
        };

        eventSource.onerror = (err) => {
          // EventSource will automatically attempt reconnection
          console.warn("SSE stream connection issue, attempting auto-reconnect...");
        };
      } catch (e) {
        console.warn("Could not establish EventSource connection:", e);
      }

      return () => {
        const idx = sseListeners.indexOf(callback);
        if (idx !== -1) sseListeners.splice(idx, 1);
        if (sseListeners.length === 0 && eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    },

    /**
     * Close the real-time event stream (e.g. on logout)
     */
    closeRealtime() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      sseListeners = [];
    },
  };

  window.ExpenseGuardAPI = ExpenseGuardAPI;
})();
