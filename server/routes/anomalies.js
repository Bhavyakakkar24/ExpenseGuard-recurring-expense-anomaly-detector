const express = require("express");
const mongoose = require("mongoose");
const Anomaly = require("../models/Anomaly");
const Transaction = require("../models/Transaction");
const { verifyFirebaseToken } = require("../middleware/verifyFirebaseToken");
const { findAnomalies, computeAnomalyMetadata } = require("../utils/anomalyDetector");
const { broadcastToUser } = require("../utils/realtime");

const router = express.Router();

// Protect all anomaly routes with Firebase Authentication
router.use(verifyFirebaseToken);

/**
 * Format explainable detection reason based on statistical algorithm output
 */
function buildDetectionReason(tx) {
  const z = Number(tx.zScore || 0);
  const ratio = Number(tx.patternRatio || 1);
  const risk = (tx.riskLevel || "Medium").toUpperCase();

  if (risk === "HIGH" || z >= 2.6 || ratio >= 3.0) {
    if (ratio >= 3.0) {
      return `Spending multiplier (${ratio.toFixed(2)}×) exceeds High-Risk threshold (≥ 3.00× category baseline average).`;
    }
    return `Statistical Z-Score (${z.toFixed(2)}) exceeds High-Risk threshold (≥ 2.60 standard deviations from category mean).`;
  } else {
    if (ratio >= 1.6) {
      return `Spending multiplier (${ratio.toFixed(2)}×) exceeds Medium-Risk threshold (≥ 1.60× category baseline average).`;
    }
    return `Statistical Z-Score (${z.toFixed(2)}) exceeds Medium-Risk threshold (≥ 1.80 standard deviations from category mean).`;
  }
}

/**
 * Core detection & synchronization helper for authenticated user
 */
async function syncUserAnomalies(firebaseUid) {
  // 1. Fetch real user transactions
  const transactions = await Transaction.find({ firebaseUid })
    .sort({ date: -1, createdAt: -1 })
    .lean();

  if (!transactions || transactions.length === 0) {
    // If user has no transactions, remove any leftover unreviewed anomaly records
    await Anomaly.deleteMany({ firebaseUid, status: "new" });
    return [];
  }

  // 2. Run existing statistical detection algorithm against actual transaction records
  const detected = findAnomalies(transactions);
  const detectedTxIds = [];

  // 3. Upsert genuine anomalies into MongoDB Atlas anomalies collection
  for (const t of detected) {
    const txId = t._id ? t._id.toString() : t.id;
    detectedTxIds.push(new mongoose.Types.ObjectId(txId));

    const reason = buildDetectionReason(t);
    const severity = (t.riskLevel || "medium").toLowerCase();
    const anomalyType = severity === "high" ? "High-Risk Spike" : "Medium-Risk Outlier";

    await Anomaly.findOneAndUpdate(
      { firebaseUid, transactionId: txId },
      {
        $set: {
          firebaseUid,
          transactionId: txId,
          description: t.description || "Untitled expense",
          amount: Number(t.amount) || 0,
          category: t.category || "Other",
          date: t.date,
          anomalyType,
          severity,
          detectionReason: reason,
          score: Number(t.zScore || 0),
          patternRatio: Number(t.patternRatio || 1),
          detectedAt: new Date(),
        },
        $setOnInsert: {
          status: "new",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  // 4. Clean up stale 'new' anomaly records for transactions that are no longer anomalous or were deleted
  await Anomaly.deleteMany({
    firebaseUid,
    status: "new",
    transactionId: { $nin: detectedTxIds },
  });

  // 5. Return all persisted anomalies for the user
  const allSaved = await Anomaly.find({ firebaseUid })
    .sort({ date: -1, createdAt: -1 })
    .lean({ virtuals: true });

  return allSaved.map((a) => ({
    id: a._id ? a._id.toString() : a.id,
    transactionId: a.transactionId ? a.transactionId.toString() : "",
    description: a.description,
    amount: a.amount,
    category: a.category,
    date: a.date,
    anomalyType: a.anomalyType || "Statistical Outlier",
    severity: (a.severity || "medium").toLowerCase(),
    risk: (a.severity || "medium").toLowerCase(),
    riskLevel: (a.severity || "medium").toUpperCase(),
    detectionReason: a.detectionReason,
    score: a.score || 0,
    zScore: a.score || 0,
    patternRatio: a.patternRatio || 1,
    ratio: a.patternRatio || 1,
    status: (a.status || "new").toLowerCase(),
    detectedAt: a.detectedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
}

// ============================================================
// GET /api/anomalies
// Retrieve authenticated user's persisted anomalies
// ============================================================
router.get("/", async (req, res, next) => {
  try {
    const filter = { firebaseUid: req.user.uid };

    if (req.query.status) {
      filter.status = String(req.query.status).trim().toLowerCase();
    }
    if (req.query.severity) {
      filter.severity = String(req.query.severity).trim().toLowerCase();
    }

    let records = await Anomaly.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .lean({ virtuals: true });

    // Auto-sync on initial access if database collection is empty but user has transactions
    if (records.length === 0 && !req.query.status && !req.query.severity) {
      const txCount = await Transaction.countDocuments({ firebaseUid: req.user.uid });
      if (txCount > 0) {
        records = await syncUserAnomalies(req.user.uid);
      }
    }

    const normalized = records.map((a) => ({
      id: a._id ? a._id.toString() : a.id,
      transactionId: a.transactionId ? a.transactionId.toString() : "",
      description: a.description,
      amount: a.amount,
      category: a.category,
      date: a.date,
      anomalyType: a.anomalyType || "Statistical Outlier",
      severity: (a.severity || "medium").toLowerCase(),
      risk: (a.severity || "medium").toLowerCase(),
      riskLevel: (a.severity || "medium").toUpperCase(),
      detectionReason: a.detectionReason,
      score: a.score || 0,
      zScore: a.score || 0,
      patternRatio: a.patternRatio || 1,
      ratio: a.patternRatio || 1,
      status: (a.status || "new").toLowerCase(),
      detectedAt: a.detectedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
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
// POST /api/anomalies/detect and POST /api/anomalies/sync
// Run real detection against transactions and persist to MongoDB
// ============================================================
async function handleDetect(req, res, next) {
  try {
    const anomalies = await syncUserAnomalies(req.user.uid);

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "ANOMALIES_SYNCED",
      count: anomalies.length,
    });

    return res.status(200).json({
      success: true,
      message: `Anomaly detection completed (${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} persisted)`,
      count: anomalies.length,
      data: anomalies,
    });
  } catch (error) {
    next(error);
  }
}

router.post("/detect", handleDetect);
router.post("/sync", handleDetect);

// ============================================================
// GET /api/anomalies/:id
// Retrieve single anomaly owned by authenticated user
// ============================================================
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid anomaly ID format",
      });
    }

    const anomaly = await Anomaly.findOne({
      _id: id,
      firebaseUid: req.user.uid,
    }).lean({ virtuals: true });

    if (!anomaly) {
      return res.status(404).json({
        success: false,
        error: "Anomaly record not found or you are not authorized to view it",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: anomaly._id ? anomaly._id.toString() : anomaly.id,
        transactionId: anomaly.transactionId ? anomaly.transactionId.toString() : "",
        description: anomaly.description,
        amount: anomaly.amount,
        category: anomaly.category,
        date: anomaly.date,
        anomalyType: anomaly.anomalyType || "Statistical Outlier",
        severity: (anomaly.severity || "medium").toLowerCase(),
        risk: (anomaly.severity || "medium").toLowerCase(),
        riskLevel: (anomaly.severity || "medium").toUpperCase(),
        detectionReason: anomaly.detectionReason,
        score: anomaly.score || 0,
        zScore: anomaly.score || 0,
        patternRatio: anomaly.patternRatio || 1,
        ratio: anomaly.patternRatio || 1,
        status: (anomaly.status || "new").toLowerCase(),
        detectedAt: anomaly.detectedAt,
        createdAt: anomaly.createdAt,
        updatedAt: anomaly.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PATCH /api/anomalies/:id
// Update anomaly review status (e.g. 'new', 'reviewed', 'dismissed')
// ============================================================
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid anomaly ID format",
      });
    }

    const status = req.body.status ? String(req.body.status).trim().toLowerCase() : "";
    const allowedStatuses = ["new", "reviewed", "dismissed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed values are: ${allowedStatuses.join(", ")}`,
      });
    }

    const updated = await Anomaly.findOneAndUpdate(
      { _id: id, firebaseUid: req.user.uid },
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Anomaly record not found or you are not authorized to update it",
      });
    }

    const jsonResult = updated.toJSON();

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "ANOMALY_UPDATED",
      anomaly: jsonResult,
    });

    return res.status(200).json({
      success: true,
      message: `Anomaly status updated to '${status}'`,
      data: jsonResult,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE /api/anomalies/:id
// Delete/dismiss an anomaly record from MongoDB (preserves transaction)
// ============================================================
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid anomaly ID format",
      });
    }

    const deleted = await Anomaly.findOneAndDelete({
      _id: id,
      firebaseUid: req.user.uid,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Anomaly record not found or you are not authorized to delete it",
      });
    }

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "ANOMALY_DELETED",
      id: id,
    });

    return res.status(200).json({
      success: true,
      message: "Anomaly record dismissed from MongoDB Atlas (transaction preserved)",
      id: id,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.syncUserAnomalies = syncUserAnomalies;
