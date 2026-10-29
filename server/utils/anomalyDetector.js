// ============================================================
// EXPENSEGUARD — SERVER ANOMALY DETECTOR UTILITY (CE-2)
// Statistical Z-score & Pattern-Ratio anomaly detection
// Criteria:
// - Z-score: Z = (X - μ) / σ
// - Pattern Ratio: R = X / μ
// - High Risk: |Z| >= 2.6 OR R >= 3.0
// - Medium Risk: |Z| >= 1.8 OR R >= 1.6
// - Normal: Anything below
// ============================================================

/**
 * Compute anomaly metadata for a single transaction against category history
 * @param {Object} tx - The transaction being evaluated { amount, category }
 * @param {Array} allUserTransactions - All transactions for this user
 * @returns {Object} { zScore, patternRatio, riskLevel, isAnomaly }
 */
function computeAnomalyMetadata(tx, allUserTransactions = []) {
  const amt = Number(tx.amount) || 0;
  const cat = (tx.category || "Other").trim().toLowerCase();

  // Filter category transactions
  const catTransactions = (allUserTransactions || []).filter(
    (t) => (t.category || "Other").trim().toLowerCase() === cat
  );

  const catAmounts = catTransactions.map((t) => Number(t.amount) || 0);

  let mean = 0;
  let sd = 0;

  if (catAmounts.length > 0) {
    mean = catAmounts.reduce((sum, val) => sum + val, 0) / catAmounts.length;
    const variance =
      catAmounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      catAmounts.length;
    sd = Math.sqrt(variance);
  }

  let zScore = 0;
  let patternRatio = 1;

  if (catAmounts.length >= 2) {
    zScore = sd > 0 ? (amt - mean) / sd : 0;
    patternRatio = mean > 0 ? amt / mean : 1;
  } else {
    // Single transaction baseline: compare against global mean across all categories
    const allAmounts = (allUserTransactions || []).map(
      (t) => Number(t.amount) || 0
    );
    const globalMean =
      allAmounts.length > 0
        ? allAmounts.reduce((s, v) => s + v, 0) / allAmounts.length
        : 0;

    if (globalMean > 0) {
      patternRatio = amt / globalMean;
      zScore = amt >= globalMean * 1.6 ? amt / globalMean : 0;
    } else {
      zScore = 0;
      patternRatio = 1;
    }
  }

  if (!Number.isFinite(zScore)) zScore = 0;
  if (!Number.isFinite(patternRatio)) patternRatio = 1;

  zScore = Number(zScore.toFixed(2));
  patternRatio = Number(patternRatio.toFixed(2));

  let riskLevel = "Normal";
  let isAnomaly = false;

  if (Math.abs(zScore) >= 2.6 || patternRatio >= 3.0) {
    riskLevel = "High";
    isAnomaly = true;
  } else if (Math.abs(zScore) >= 1.8 || patternRatio >= 1.6) {
    riskLevel = "Medium";
    isAnomaly = true;
  } else {
    riskLevel = "Normal";
    isAnomaly = false;
  }

  return {
    zScore,
    patternRatio,
    riskLevel,
    isAnomaly,
  };
}

/**
 * Analyze an entire list of transactions and return those flagged as anomalies
 * @param {Array} transactions - All transactions for a user
 * @returns {Array} Flagged transactions with anomaly metadata attached
 */
function findAnomalies(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  return transactions
    .map((tx) => {
      const metadata = computeAnomalyMetadata(tx, transactions);
      const plain = typeof tx.toJSON === "function" ? tx.toJSON() : { ...tx };
      return {
        ...plain,
        anomalyMetadata: metadata,
        isAnomaly: metadata.isAnomaly,
        riskLevel: metadata.riskLevel,
        zScore: metadata.zScore,
        patternRatio: metadata.patternRatio,
      };
    })
    .filter((t) => t.anomalyMetadata.isAnomaly);
}

module.exports = {
  computeAnomalyMetadata,
  findAnomalies,
};
