// ExpenseGuard — Anomaly Center
document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("anomalySearch");
  const sort = document.getElementById("anomalySort");
  let activeRisk = "all";

  function buildAnalysis() {
    const tx = getTransactions().map((t) => ({
      ...t,
      amount: Number(t.amount) || 0,
    }));
    if (!tx.length) return [];
    const groups = {};
    tx.forEach((t) => (groups[t.category] ||= []).push(t.amount));
    const global = tx.map((t) => t.amount);
    const globalMean = calculateMean(global);
    return tx.map((t) => {
      const values = groups[t.category];
      const mean = calculateMean(values);
      const sd = calculateStandardDeviation(values);
      let z = sd ? (t.amount - mean) / sd : 0;
      // Helpful fallback for small categories: compare against overall spending.
      if (values.length < 2 && globalMean > 0)
        z = t.amount >= globalMean * 1.6 ? t.amount / globalMean : 0;
      const ratio = mean > 0 ? t.amount / mean : 0;
      const unusual = Math.abs(z) >= 1.8 || (values.length < 2 && ratio >= 1.6);
      const risk = unusual
        ? Math.abs(z) >= 2.6 || ratio >= 3
          ? "high"
          : "medium"
        : "low";
      return {
        ...t,
        zScore: Number(z.toFixed(2)),
        risk,
        isAnomaly: unusual,
        ratio,
      };
    });
  }

  function money(n) {
    return (
      "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })
    );
  }
  function updateStats(all, flags) {
    const total = all.reduce((s, t) => s + t.amount, 0),
      spend = flags.reduce((s, t) => s + t.amount, 0);
    const highest = flags.slice().sort((a, b) => b.amount - a.amount)[0],
      peak = flags.reduce((m, t) => Math.max(m, Math.abs(t.zScore)), 0);
    document.getElementById("totalAnomalies").textContent = flags.length;
    document.getElementById("highestAnomaly").textContent = money(
      highest?.amount || 0,
    );
    document.getElementById("highestZScore").textContent = peak.toFixed(2);
    document.getElementById("anomalySpending").textContent = money(spend);
    document.getElementById("flaggedLabel").textContent = flags.length
      ? `${flags.filter((x) => x.risk === "high").length} high-risk alert${flags.filter((x) => x.risk === "high").length === 1 ? "" : "s"}`
      : "Everything looks normal";
    document.getElementById("highestAnomalyLabel").textContent = highest
      ? `${highest.category} expense`
      : "No unusual expense";
    document.getElementById("highestZScoreLabel").textContent =
      peak >= 2.6
        ? "Highly unusual"
        : peak >= 1.8
          ? "Needs review"
          : "Normal range";
    document.getElementById("anomalySpendingLabel").textContent = total
      ? `${((spend / total) * 100).toFixed(1)}% of total spending`
      : "0% of total spending";
    const risk = all.length
      ? Math.min(
          100,
          Math.round(
            (flags.length / all.length) * 100 +
              flags.filter((x) => x.risk === "high").length * 10,
          ),
        )
      : 0;
    document.getElementById("riskPercent").textContent = risk + "%";
    document.getElementById("riskBar").style.width = Math.max(4, risk) + "%";
    document.getElementById("riskHeadline").textContent = flags.length
      ? "Some spending needs attention"
      : "All clear — spending looks healthy";
    document.getElementById("riskSummary").textContent = flags.length
      ? `${flags.length} transaction${flags.length === 1 ? "" : "s"} look unusual compared with your normal pattern.`
      : "No unusual transactions were found in your saved data.";
  }

  function render() {
    const all = buildAnalysis(),
      flags = all.filter((t) => t.isAnomaly);
    updateStats(all, flags);
    const q = (search?.value || "").toLowerCase().trim(),
      filtered = flags
        .filter((t) =>
          (t.description + " " + t.category).toLowerCase().includes(q),
        )
        .filter((t) => activeRisk === "all" || t.risk === activeRisk);
    if (sort.value === "amount") filtered.sort((a, b) => b.amount - a.amount);
    if (sort.value === "zscore")
      filtered.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    if (sort.value === "recent")
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const box = document.getElementById("anomalyList");
    box.innerHTML = "";
    if (!filtered.length) {
      box.innerHTML = `<div class="no-anomalies"><div class="no-anomalies-icon">✓</div><h3>${flags.length ? "No matching alerts" : "No anomalies detected"}</h3><p>${flags.length ? "Try another search or risk filter." : "Your transactions are currently within a normal spending pattern."}</p></div>`;
      return;
    }
    filtered.forEach((t) => {
      const el = document.createElement("article");
      el.className = `detected-anomaly-card ${t.risk}`;
      const reason =
        t.risk === "high"
          ? `This is far above the usual level for ${t.category}. Review whether the expense was expected.`
          : `This expense is higher than the normal pattern for ${t.category}. Consider checking the transaction details.`;
      el.innerHTML = `<div class="anomaly-card-header"><div><h3>${t.risk === "high" ? "🚨 High-risk" : "⚠ Medium-risk"} · ${escapeHTML(t.category)}</h3><p>${escapeHTML(t.description || "Untitled expense")}</p><span class="risk-badge ${t.risk}">${t.risk.toUpperCase()} RISK</span></div><strong class="anomaly-card-amount">${money(t.amount)}</strong></div>
      <div class="anomaly-card-info"><span>📅 ${formatDate(t.date)}</span><span>Category: ${escapeHTML(t.category)}</span><span class="z-score">Z-Score: ${t.zScore.toFixed(2)}</span><span>Pattern ratio: ${t.ratio.toFixed(1)}×</span></div>
      <div class="anomaly-reason"><strong>Why was it flagged?</strong><p>${reason}</p></div>
      <button class="view-transaction-btn" data-id="${t.id}">View transaction →</button>`;
      box.appendChild(el);
    });
    box
      .querySelectorAll(".view-transaction-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          showAnomalyDetails(Number(btn.dataset.id)),
        ),
      );
  }

  function showAnomalyDetails(id) {
    const t = buildAnalysis().find((x) => x.id === id);
    if (!t) return;
    alert(
      `ANOMALY DETAILS\n\nDescription: ${t.description}\nAmount: ${money(t.amount)}\nCategory: ${t.category}\nDate: ${formatDate(t.date)}\nZ-Score: ${t.zScore}\nRisk: ${t.risk.toUpperCase()}\nPattern ratio: ${t.ratio.toFixed(1)}×\n\nThreshold: 1.80`,
    );
  }
  window.showAnomalyDetails = showAnomalyDetails;
  search?.addEventListener("input", render);
  sort?.addEventListener("change", render);
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
  document.getElementById("demoAnomaly")?.addEventListener("click", () => {
    const today = new Date().toISOString().slice(0, 10);
    addTransaction({
      date: today,
      category: "Food",
      description: "Premium dining — demo alert",
      amount: 12500,
    });
    render();
  });
  const u = getCurrentUser && getCurrentUser();
  if (u) {
    document.getElementById("anUser").textContent = u.name;
    document.getElementById("anInitials").textContent = getUserInitials(u.name);
  }
  render();
});
