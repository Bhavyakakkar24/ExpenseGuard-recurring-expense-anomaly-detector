const express = require("express");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const { verifyFirebaseToken } = require("../middleware/verifyFirebaseToken");
const { registerClient, broadcastToUser } = require("../utils/realtime");
const { computeAnomalyMetadata, findAnomalies } = require("../utils/anomalyDetector");
const admin = require("firebase-admin");

const router = express.Router();

// Allowed categories matching application domain
const ALLOWED_CATEGORIES = [
  "Food",
  "Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Utilities",
  "Rent",
  "Mobile / Internet",
  "Entertainment",
  "Healthcare",
  "Education",
  "Subscriptions",
  "Other",
];

/**
 * Validate transaction payload
 */
function validateTransactionPayload(body) {
  const errors = [];

  // Amount
  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0 || !Number.isFinite(amount)) {
    errors.push("Amount must be a positive number greater than 0");
  }

  // Date
  if (!body.date || typeof body.date !== "string") {
    errors.push("Date is required");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())) {
    errors.push("Date must be in YYYY-MM-DD format");
  } else {
    const parsedDate = new Date(body.date + "T00:00:00Z");
    if (isNaN(parsedDate.getTime())) {
      errors.push("Date value is not a valid calendar date");
    }
  }

  // Category
  if (!body.category || typeof body.category !== "string" || !body.category.trim()) {
    errors.push("Category is required");
  }

  // Description
  if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
    errors.push("Description is required");
  } else if (body.description.trim().length > 200) {
    errors.push("Description cannot exceed 200 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================
// REAL-TIME SSE STREAM (MUST BE BEFORE verifyFirebaseToken IF USING QUERY TOKEN)
// ============================================================
router.get("/stream", async (req, res) => {
  // Extract token from query or Authorization header
  let token = req.query.token;
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split("Bearer ")[1].trim();
  }

  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication token required for stream." });
  }

  let uid = null;

  // Support test mock tokens
  if (process.env.NODE_ENV === "test" && token.startsWith("test-token-")) {
    uid = token.replace("test-token-", "");
  } else {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (err) {
      return res.status(401).json({ success: false, error: "Invalid stream token." });
    }
  }

  // Setup SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  registerClient(uid, res);
});

// Protect all remaining routes
router.use(verifyFirebaseToken);

// ============================================================
// GET /api/transactions
// List all transactions owned by the authenticated user
// ============================================================
router.get("/", async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ firebaseUid: req.user.uid })
      .sort({ date: -1, createdAt: -1 })
      .lean({ virtuals: true });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions.map((t) => ({
        id: t._id ? t._id.toString() : t.id,
        date: t.date,
        category: t.category,
        description: t.description,
        amount: t.amount,
        isRecurring: Boolean(t.isRecurring),
        paymentMethod: t.paymentMethod || "Other",
        tags: t.tags || [],
        anomalyMetadata: t.anomalyMetadata || {
          zScore: 0,
          patternRatio: 1,
          riskLevel: "Normal",
          isAnomaly: false,
        },
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/transactions
// Create a new transaction owned by the authenticated user
// ============================================================
router.post("/", async (req, res, next) => {
  try {
    const validation = validateTransactionPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.errors,
      });
    }

    // Match or normalize category
    let category = req.body.category.trim();
    const matchedCategory = ALLOWED_CATEGORIES.find(
      (c) => c.toLowerCase() === category.toLowerCase()
    );
    if (matchedCategory) {
      category = matchedCategory;
    } else {
      category = "Other";
    }

    // Explicitly construct fields to prevent mass assignment
    const transactionData = {
      firebaseUid: req.user.uid, // Authoritative owner from verified token
      date: req.body.date.trim(),
      category: category,
      description: req.body.description.trim(),
      amount: Number(Number(req.body.amount).toFixed(2)),
      isRecurring: Boolean(req.body.isRecurring),
      paymentMethod: req.body.paymentMethod ? String(req.body.paymentMethod).trim() : "Other",
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : [],
    };

    // Evaluate anomaly criteria against user's transaction history
    if (!req.body.anomalyMetadata) {
      const userHistory = await Transaction.find({ firebaseUid: req.user.uid })
        .select("amount category")
        .lean();
      transactionData.anomalyMetadata = computeAnomalyMetadata(
        { amount: transactionData.amount, category: transactionData.category },
        userHistory
      );
    }

    const newTransaction = await Transaction.create(transactionData);
    const jsonResult = newTransaction.toJSON();

    // Broadcast SSE to other open sessions of this user
    broadcastToUser(req.user.uid, {
      type: "TRANSACTION_CREATED",
      transaction: jsonResult,
    });

    return res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: jsonResult,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/transactions/batch
// Bulk import/migrate transactions for the authenticated user
// ============================================================
router.post("/batch", async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Items array is required and must not be empty",
      });
    }

    if (items.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Batch limit exceeded (maximum 500 items per import)",
      });
    }

    const docsToInsert = [];
    const skippedItems = [];

    items.forEach((item, index) => {
      const amount = Number(item.amount);
      if (isNaN(amount) || amount <= 0 || !Number.isFinite(amount)) {
        skippedItems.push({ index, reason: "Invalid amount" });
        return;
      }

      let date = item.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) {
        date = new Date().toISOString().slice(0, 10);
      } else {
        date = String(date).trim();
      }

      let category = item.category ? String(item.category).trim() : "Other";
      const matched = ALLOWED_CATEGORIES.find(
        (c) => c.toLowerCase() === category.toLowerCase()
      );
      category = matched || "Other";

      const description = item.description ? String(item.description).trim().slice(0, 200) : "Imported Expense";

      docsToInsert.push({
        firebaseUid: req.user.uid,
        date: date,
        category: category,
        description: description,
        amount: Number(amount.toFixed(2)),
        isRecurring: Boolean(item.isRecurring),
        paymentMethod: item.paymentMethod || "Other",
        tags: Array.isArray(item.tags) ? item.tags : [],
      });
    });

    if (docsToInsert.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid transactions found in batch",
        skipped: skippedItems,
      });
    }

    const inserted = await Transaction.insertMany(docsToInsert);

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "BATCH_IMPORTED",
      count: inserted.length,
    });

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${inserted.length} transactions`,
      count: inserted.length,
      skipped: skippedItems.length,
      data: inserted.map((doc) => doc.toJSON()),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/transactions/anomalies
// Retrieve only the anomalous transactions for authenticated user
// ============================================================
router.get("/anomalies", async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ firebaseUid: req.user.uid })
      .sort({ date: -1, createdAt: -1 })
      .lean({ virtuals: true });

    const anomalies = findAnomalies(transactions);

    // Normalize id and flatten anomalyMetadata for frontend consumption
    const normalized = anomalies.map((t) => ({
      id: t._id ? t._id.toString() : (t.id || ""),
      date: t.date,
      category: t.category,
      description: t.description,
      amount: t.amount,
      isRecurring: Boolean(t.isRecurring),
      paymentMethod: t.paymentMethod || "Other",
      tags: t.tags || [],
      anomalyMetadata: t.anomalyMetadata || {
        zScore: t.zScore || 0,
        patternRatio: t.patternRatio || 1,
        riskLevel: t.riskLevel || "Normal",
        isAnomaly: t.isAnomaly || false,
      },
      // Flatten for direct frontend usage (matches analyzeTransactionRisk output shape)
      isAnomaly: Boolean(t.isAnomaly),
      zScore: Number(t.zScore || 0),
      patternRatio: Number(t.patternRatio || 1),
      ratio: Number(t.patternRatio || 1),
      riskLevel: t.riskLevel || "Normal",
      risk: (t.riskLevel || "Normal").toLowerCase(),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      count: normalized.length,
      data: normalized,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PUT /api/transactions/:id
// Update an owned transaction
// ============================================================
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid transaction ID format",
      });
    }

    // Validate update fields if present
    const allowedFields = [
      "date",
      "category",
      "description",
      "amount",
      "isRecurring",
      "paymentMethod",
      "tags",
      "anomalyMetadata",
    ];

    const updates = {};
    for (const key of Object.keys(req.body)) {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid update fields provided",
      });
    }

    // Validate specific fields if updated
    if (updates.amount !== undefined) {
      const amount = Number(updates.amount);
      if (isNaN(amount) || amount <= 0 || !Number.isFinite(amount)) {
        return res.status(400).json({
          success: false,
          error: "Amount must be a positive number greater than 0",
        });
      }
      updates.amount = Number(amount.toFixed(2));
    }

    if (updates.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(updates.date).trim())) {
        return res.status(400).json({
          success: false,
          error: "Date must be in YYYY-MM-DD format",
        });
      }
      updates.date = String(updates.date).trim();
    }

    if (updates.category !== undefined) {
      let cat = String(updates.category).trim();
      const matched = ALLOWED_CATEGORIES.find(
        (c) => c.toLowerCase() === cat.toLowerCase()
      );
      updates.category = matched || "Other";
    }

    if (updates.description !== undefined) {
      const desc = String(updates.description).trim();
      if (!desc) {
        return res.status(400).json({
          success: false,
          error: "Description cannot be empty",
        });
      }
      updates.description = desc.slice(0, 200);
    }

    // Recompute anomaly metadata if amount or category is updated
    if (updates.amount !== undefined || updates.category !== undefined) {
      const existing = await Transaction.findOne({ _id: id, firebaseUid: req.user.uid });
      if (existing) {
        const userHistory = await Transaction.find({
          firebaseUid: req.user.uid,
          _id: { $ne: id },
        })
          .select("amount category")
          .lean();

        const testAmt = updates.amount !== undefined ? updates.amount : existing.amount;
        const testCat = updates.category !== undefined ? updates.category : existing.category;
        updates.anomalyMetadata = computeAnomalyMetadata(
          { amount: testAmt, category: testCat },
          userHistory
        );
      }
    }

    // Strictly scope query by ID AND authenticated user UID
    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, firebaseUid: req.user.uid },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found or you are not authorized to update it",
      });
    }

    const jsonResult = transaction.toJSON();

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "TRANSACTION_UPDATED",
      transaction: jsonResult,
    });

    return res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: jsonResult,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE /api/transactions/:id
// Delete an owned transaction
// ============================================================
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid transaction ID format",
      });
    }

    // Strictly scope delete by ID AND authenticated user UID
    const deleted = await Transaction.findOneAndDelete({
      _id: id,
      firebaseUid: req.user.uid,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found or you are not authorized to delete it",
      });
    }

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "TRANSACTION_DELETED",
      id: id,
    });

    return res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
      id: id,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
