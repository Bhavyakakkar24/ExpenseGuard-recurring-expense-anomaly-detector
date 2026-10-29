// ============================================================
// EXPENSEGUARD — ANOMALY CENTER (CE-2 MONGODB PERSISTENT)
// Statistical Z-score & Pattern-Ratio anomaly detection & review
// Fully persistent with MongoDB Atlas 'anomalies' collection
// ============================================================

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(d) {
  if (!d) return "—";
  try {
    const parts = String(d).split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const date = new Date(year, month, day);
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return String(d);
  } catch (e) {
    return String(d);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("anomalySearch");
  const sort = document.getElementById("anomalySort");
  const statusFilter = document.getElementById("anomalyStatusFilter");
  const syncBtn = document.getElementById("syncAnomaliesBtn");
  let activeRisk = "all";

  // ── Alert Notification Helper ─────────────────────────────
  const alertEl = document.getElementById("anomalyAlert");
  const alertMsgEl = document.getElementById("anomalyAlertMsg");
  const alertCloseBtn = document.getElementById("anomalyAlertClose");
  let alertTimer = null;

  function showAlert(msg, type = "success") {
    if (!alertEl || !alertMsgEl) return;
    if (alertTimer) clearTimeout(alertTimer);

    alertEl.className = `anomaly-alert alert-${type}`;
    alertMsgEl.textContent = msg;
    alertEl.style.display = "flex";

    alertTimer = setTimeout(() => {
      hideAlert();
    }, 6000);
  }

  function hideAlert() {
    if (alertEl) alertEl.style.display = "none";
  }

  if (alertCloseBtn) alertCloseBtn.addEventListener("click", hideAlert);

  function money(n) {
    return (
      "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })
    );
  }

  function updateStats(all, flags) {
    const total = all.reduce((s, t) => s + Number(t.amount || 0), 0);
    // Active flags excluding dismissed
    const activeFlags = flags.filter((f) => (f.status || "new").toLowerCase() !== "dismissed");
    const spend = activeFlags.reduce((s, t) => s + Number(t.amount || 0), 0);
    const highest = activeFlags.slice().sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
    const peak = flags.reduce((m, t) => Math.max(m, Math.abs(Number(t.zScore || t.score || 0))), 0);

    const totalEl = document.getElementById("totalAnomalies");
    const highEl = document.getElementById("highestAnomaly");
    const zEl = document.getElementById("highestZScore");
    const spendEl = document.getElementById("anomalySpending");
    const flagLbl = document.getElementById("flaggedLabel");
    const highLbl = document.getElementById("highestAnomalyLabel");
    const zLbl = document.getElementById("highestZScoreLabel");
    const spendLbl = document.getElementById("anomalySpendingLabel");
    const riskPctEl = document.getElementById("riskPercent");
    const riskBarEl = document.getElementById("riskBar");
    const headEl = document.getElementById("riskHeadline");
    const sumEl = document.getElementById("riskSummary");

    if (totalEl) totalEl.textContent = activeFlags.length;
    if (highEl) highEl.textContent = money(highest?.amount || 0);
    if (zEl) zEl.textContent = peak.toFixed(2);
    if (spendEl) spendEl.textContent = money(spend);

    const highCount = activeFlags.filter((x) => (x.risk || x.severity || "").toLowerCase() === "high").length;
    if (flagLbl) {
      flagLbl.textContent = activeFlags.length
        ? `${highCount} high-risk alert${highCount === 1 ? "" : "s"}`
        : "Everything looks normal";
    }

    if (highLbl) {
      highLbl.textContent = highest
        ? `${highest.category} expense`
        : "No unusual expense";
    }

    if (zLbl) {
      zLbl.textContent =
        peak >= 2.6
          ? "Highly unusual"
          : peak >= 1.8
            ? "Needs review"
            : "Normal range";
    }

    if (spendLbl) {
      spendLbl.textContent = total
        ? `${((spend / total) * 100).toFixed(1)}% of total spending`
        : "0% of total spending";
    }

    const risk = all.length
      ? Math.min(
          100,
          Math.round(
            (activeFlags.length / all.length) * 100 + highCount * 10,
          ),
        )
      : 0;

    if (riskPctEl) riskPctEl.textContent = risk + "%";
    if (riskBarEl) riskBarEl.style.width = Math.max(4, risk) + "%";
    if (headEl) {
      headEl.textContent = activeFlags.length
        ? "Some spending needs attention"
        : "All clear — spending looks healthy";
    }
    if (sumEl) {
      sumEl.textContent = activeFlags.length
        ? `${activeFlags.length} transaction${activeFlags.length === 1 ? "" : "s"} look unusual compared with your normal pattern.`
        : "No active anomalous transactions found in your saved records.";
    }
  }

  async function render() {
    let allRaw = [];
    let flags = [];

    // 1. Fetch transactions to establish baseline context
    if (typeof window.fetchTransactions === "function") {
      try {
        allRaw = await window.fetchTransactions();
      } catch (e) {
        allRaw = typeof getTransactions === "function" ? getTransactions() : [];
      }
    } else if (typeof getTransactions === "function") {
      allRaw = getTransactions();
    }

    // 2. Fetch saved anomaly records from MongoDB Atlas
    if (window.ExpenseGuardAPI && typeof window.ExpenseGuardAPI.getAnomalies === "function") {
      try {
        const selectedStatus = statusFilter ? statusFilter.value : "all";
        const apiFlags = await window.ExpenseGuardAPI.getAnomalies({
          status: selectedStatus,
        });

        if (Array.isArray(apiFlags)) {
          flags = apiFlags.map((t) => ({
            ...t,
            id: t.id || t._id,
            ratio: Number(t.patternRatio || t.ratio || 1),
            patternRatio: Number(t.patternRatio || t.ratio || 1),
            zScore: Number(t.score !== undefined ? t.score : (t.zScore || 0)),
            risk: (t.severity || t.riskLevel || t.risk || "medium").toLowerCase(),
            riskLevel: (t.severity || t.riskLevel || t.risk || "medium").toUpperCase(),
            status: (t.status || "new").toLowerCase(),
            isPersisted: true,
          }));

          updateStats(allRaw, flags);
          renderFlags(flags, allRaw);
          return;
        }
      } catch (apiErr) {
        console.warn("Could not fetch anomalies from API, falling back to local detection:", apiErr.message);
      }
    }

    // 3. Fallback: compute locally if API is completely unavailable
    if (typeof window.analyzeAllTransactions === "function") {
      const all = window.analyzeAllTransactions(allRaw);
      flags = all.filter((t) => t.isAnomaly);
      updateStats(allRaw, flags);
      renderFlags(flags, allRaw);
    }
  }

  function renderFlags(flags, allRaw = []) {
    const q = (search?.value || "").toLowerCase().trim();
    const currentStatus = statusFilter ? statusFilter.value : "all";

    let filtered = flags.filter((t) => {
      const textMatch = (String(t.description || "") + " " + String(t.category || "")).toLowerCase().includes(q);
      const riskMatch = activeRisk === "all" || t.risk === activeRisk;
      const statusMatch = currentStatus === "all" || (t.status || "new") === currentStatus;
      return textMatch && riskMatch && statusMatch;
    });

    if (sort?.value === "amount") {
      filtered.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    } else if (sort?.value === "zscore") {
      filtered.sort((a, b) => Math.abs(Number(b.zScore || 0)) - Math.abs(Number(a.zScore || 0)));
    } else if (sort?.value === "recent") {
      filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }

    const box = document.getElementById("anomalyList");
    if (!box) return;
    box.innerHTML = "";

    if (!filtered.length) {
      const emptyTitle = flags.length === 0 ? "No anomalies detected" : "No matching alerts";
      const emptyMsg = flags.length === 0
        ? "Your transactions are currently within a normal spending pattern."
        : "Try another search, risk level, or review status filter.";
      box.innerHTML = `<div class="no-anomalies"><div class="no-anomalies-icon">✓</div><h3>${emptyTitle}</h3><p>${emptyMsg}</p></div>`;
      return;
    }

    filtered.forEach((t) => {
      const el = document.createElement("article");
      el.className = `detected-anomaly-card ${t.risk}`;

      const reason = t.detectionReason
        ? t.detectionReason
        : t.risk === "high"
          ? `This is far above the usual level for ${t.category}. Review whether the expense was expected.`
          : `This expense is higher than the normal pattern for ${t.category}. Consider checking the transaction details.`;

      const txId = t.transactionId || t.id || "";
      const anomalyId = t.id || "";
      const status = (t.status || "new").toLowerCase();

      // Action buttons depending on current review status
      let actionButtons = "";
      if (status !== "reviewed") {
        actionButtons += `<button type="button" class="status-btn review-btn" data-id="${anomalyId}">✓ Mark Reviewed</button>`;
      }
      if (status !== "dismissed") {
        actionButtons += `<button type="button" class="status-btn dismiss-btn" data-id="${anomalyId}">✕ Dismiss</button>`;
      }
      if (status !== "new") {
        actionButtons += `<button type="button" class="status-btn reopen-btn" data-id="${anomalyId}">↺ Reopen</button>`;
      }

      el.innerHTML = `
        <div class="anomaly-card-header">
          <div>
            <h3>${t.risk === "high" ? "🚨 High-risk" : "⚠ Medium-risk"} · ${escapeHTML(t.category)}</h3>
            <p>${escapeHTML(t.description || "Untitled expense")}</p>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
              <span class="risk-badge ${t.risk}">${t.risk.toUpperCase()} RISK</span>
              <span class="anomaly-db-badge">MongoDB Atlas</span>
              <span class="status-badge ${status}">${status}</span>
            </div>
          </div>
          <strong class="anomaly-card-amount">${money(t.amount)}</strong>
        </div>

        <div class="anomaly-card-info">
          <span>📅 ${formatDate(t.date)}</span>
          <span>Category: ${escapeHTML(t.category)}</span>
          <span class="z-score">Z-Score: ${Number(t.zScore || 0).toFixed(2)}</span>
          <span>Pattern ratio: ${Number(t.patternRatio || t.ratio || 1).toFixed(2)}×</span>
          <span>Review Status: <strong style="color: #e2e8f0;">${status.toUpperCase()}</strong></span>
        </div>

        <div class="anomaly-reason">
          <strong>Why was it flagged?</strong>
          <p>${escapeHTML(reason)}</p>
        </div>

        <div class="anomaly-card-footer">
          <button class="view-transaction-btn" data-txid="${escapeHTML(txId)}" data-anomalyid="${escapeHTML(anomalyId)}">View calculation breakdown →</button>
          <div class="anomaly-actions">
            ${actionButtons}
          </div>
        </div>
      `;
      box.appendChild(el);
    });

    // Attach listeners for status mutation buttons
    box.querySelectorAll(".review-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;
          btn.textContent = "Updating…";
          await window.ExpenseGuardAPI.updateAnomalyStatus(btn.dataset.id, "reviewed");
          showAlert("Anomaly marked as 'reviewed' in MongoDB Atlas!", "success");
          await render();
        } catch (err) {
          showAlert(err.message || "Failed to update review status.", "error");
          btn.disabled = false;
        }
      });
    });

    box.querySelectorAll(".dismiss-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;
          btn.textContent = "Dismissing…";
          await window.ExpenseGuardAPI.updateAnomalyStatus(btn.dataset.id, "dismissed");
          showAlert("Anomaly dismissed in MongoDB Atlas! (Transaction preserved)", "success");
          await render();
        } catch (err) {
          showAlert(err.message || "Failed to dismiss anomaly.", "error");
          btn.disabled = false;
        }
      });
    });

    box.querySelectorAll(".reopen-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;
          btn.textContent = "Reopening…";
          await window.ExpenseGuardAPI.updateAnomalyStatus(btn.dataset.id, "new");
          showAlert("Anomaly reopened as 'new' in MongoDB Atlas!", "success");
          await render();
        } catch (err) {
          showAlert(err.message || "Failed to reopen anomaly.", "error");
          btn.disabled = false;
        }
      });
    });

    box.querySelectorAll(".view-transaction-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        showAnomalyDetails(btn.dataset.txid, btn.dataset.anomalyid, allRaw, flags);
      });
    });
  }

  function showAnomalyDetails(txId, anomalyId, allRaw = [], flags = []) {
    // Look up transaction or anomaly item
    const t = allRaw.find((x) => String(x.id || x._id) === String(txId)) ||
      flags.find((x) => String(x.id || x._id) === String(anomalyId));

    if (!t) {
      alert("Transaction details not found.");
      return;
    }

    const cat = t.category || "Other";
    const categoryTxs = allRaw.filter((x) => (x.category || "Other") === cat);
    const categoryAmounts = categoryTxs.map((x) => Number(x.amount) || 0);

    let catMean = 0;
    let catSd = 0;
    if (categoryAmounts.length > 0) {
      catMean = categoryAmounts.reduce((s, v) => s + v, 0) / categoryAmounts.length;
      const variance = categoryAmounts.reduce((s, v) => s + Math.pow(v - catMean, 2), 0) / categoryAmounts.length;
      catSd = Math.sqrt(variance);
    }

    const z = Number(t.zScore || t.score || 0);
    const ratio = Number(t.patternRatio || t.ratio || (catMean > 0 ? t.amount / catMean : 1));
    const risk = (t.riskLevel || t.severity || "MEDIUM").toUpperCase();
    const reason = t.detectionReason || (
      ratio >= 3.0
        ? `• Spending multiplier (${ratio.toFixed(2)}×) exceeds High-Risk threshold (≥ 3.00× Category Average).`
        : `• Statistical Z-Score (${z.toFixed(2)}) exceeds threshold (≥ 1.80σ).`
    );

    const message = [
      `══════════════════════════════════════════════`,
      `🚨 ANOMALY DETAIL & CALCULATION BREAKDOWN`,
      `══════════════════════════════════════════════`,
      ``,
      `📋 RECORD DETAILS (MONGODB ATLAS):`,
      `  • Description:  ${t.description || "Untitled expense"}`,
      `  • Category:     ${cat}`,
      `  • Amount:       ₹${Number(t.amount || 0).toLocaleString("en-IN")}`,
      `  • Date:         ${formatDate(t.date)}`,
      `  • Risk Level:   ${risk} RISK ANOMALY`,
      `  • Review State: ${(t.status || "NEW").toUpperCase()}`,
      ``,
      `📊 CATEGORY BASELINE (${cat}):`,
      `  • History Count:      ${categoryTxs.length} transaction(s)`,
      `  • Category Mean (μ):  ₹${catMean.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
      `  • Std Deviation (σ):  ₹${catSd.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
      ``,
      `📐 STATISTICAL CALCULATION STEPS:`,
      `  1. Deviation from Mean:`,
      `     ₹${t.amount} - ₹${catMean.toFixed(2)} = ₹${(t.amount - catMean).toFixed(2)}`,
      `  2. Z-Score: (X - μ) / σ = (${t.amount} - ${catMean.toFixed(2)}) / ${catSd > 0 ? catSd.toFixed(2) : 1}`,
      `     Z-Score = ${z.toFixed(2)}`,
      `  3. Spending Multiplier: X / μ = ₹${t.amount} / ₹${catMean.toFixed(2)}`,
      `     Pattern Ratio = ${ratio.toFixed(2)}× of baseline average`,
      ``,
      `💡 WHY WAS THIS FLAGGED?`,
      `  ${reason}`,
      `══════════════════════════════════════════════`
    ].join("\n");

    alert(message);
  }

  window.showAnomalyDetails = showAnomalyDetails;

  // ── Event Listeners ─────────────────────────────────────────
  search?.addEventListener("input", render);
  sort?.addEventListener("change", render);
  statusFilter?.addEventListener("change", render);

  document.querySelectorAll(".filter-btn").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      activeRisk = b.dataset.risk;
      render();
    }),
  );

  // Manual Trigger: Detect & Synchronize Anomalies to MongoDB Atlas
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      try {
        syncBtn.disabled = true;
        syncBtn.innerHTML = "<span>⏳</span> Detecting…";

        const anomalies = await window.ExpenseGuardAPI.detectAnomalies();
        showAlert(`Detection complete: ${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} persisted to MongoDB Atlas!`, "success");
        await render();
      } catch (err) {
        console.error("Detect anomalies error:", err);
        showAlert(err.message || "Failed to run anomaly detection.", "error");
      } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = "⚡ Detect &amp; Sync";
      }
    });
  }

  // Keep Demo Alert working: creates a high-amount transaction, then triggers detection
  document.getElementById("demoAnomaly")?.addEventListener("click", async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (typeof addTransaction === "function") {
        await addTransaction({
          date: today,
          category: "Food",
          description: "Premium dining — demo alert",
          amount: 12500,
        });
      } else if (window.ExpenseGuardAPI && typeof window.ExpenseGuardAPI.createTransaction === "function") {
        await window.ExpenseGuardAPI.createTransaction({
          date: today,
          category: "Food",
          description: "Premium dining — demo alert",
          amount: 12500,
        });
      }

      if (typeof window.fetchTransactions === "function") {
        await window.fetchTransactions(true);
      }

      // Sync anomalies to MongoDB
      if (window.ExpenseGuardAPI && typeof window.ExpenseGuardAPI.detectAnomalies === "function") {
        await window.ExpenseGuardAPI.detectAnomalies();
      }

      showAlert("Demo alert created and saved to MongoDB Atlas!", "success");
      await render();
    } catch (err) {
      console.error("Demo anomaly error:", err);
      showAlert(err.message || "Could not add demo alert.", "error");
    }
  });

  // Load User Profile in Header
  const u = typeof getCurrentUser === "function" ? getCurrentUser() : null;
  if (u) {
    const anUser = document.getElementById("anUser");
    const anInitials = document.getElementById("anInitials");
    if (anUser) anUser.textContent = u.name || u.displayName || "My Account";
    if (anInitials && typeof getUserInitials === "function") {
      anInitials.textContent = getUserInitials(u.name || u.displayName || "");
    }
  }

  render();

  window.renderAnomalies = render;
});
