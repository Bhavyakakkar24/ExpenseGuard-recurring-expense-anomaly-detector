// ============================================================
// EXPENSEGUARD — REPORTS JAVASCRIPT
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  if (typeof rememberLastPage === "function") {
    rememberLastPage("reports");
  }

  const tx = typeof getTransactions === "function" ? getTransactions() : [];
  const amounts = tx.map((t) => Number(t.amount) || 0);
  const total = amounts.reduce((s, n) => s + n, 0);

  const totalEl = document.getElementById("rTotal");
  const avgEl = document.getElementById("rAvg");
  const highEl = document.getElementById("rHigh");
  const topEl = document.getElementById("rTop");

  if (totalEl) totalEl.textContent = "₹" + total.toLocaleString("en-IN");
  if (avgEl) {
    avgEl.textContent =
      "₹" + (amounts.length ? total / amounts.length : 0).toFixed(0);
  }
  if (highEl) {
    highEl.textContent =
      "₹" + (amounts.length ? Math.max(...amounts) : 0).toLocaleString("en-IN");
  }

  const byCat = {};
  tx.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount || 0);
  });

  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (topEl) topEl.textContent = cats[0]?.[0] || "—";

  const catBox = document.getElementById("categoryReport");
  if (catBox) {
    catBox.innerHTML = cats.length
      ? cats
          .map(([c, v]) => {
            const pct = total ? (v / total) * 100 : 0;
            return `
              <div class="category">
                <div class="category-top">
                  <span class="category-name">${c}</span>
                  <span class="category-amount">₹${v.toLocaleString("en-IN")} · ${pct.toFixed(0)}%</span>
                </div>
                <div class="progress">
                  <div class="progress-bar" style="width: ${pct}%"></div>
                </div>
              </div>
            `;
          })
          .join("")
      : '<div class="empty-state">No transactions yet.</div>';
  }

  const topTransactionsEl = document.getElementById("topTransactions");
  if (topTransactionsEl) {
    const top = [...tx]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);

    topTransactionsEl.innerHTML = top.length
      ? top
          .map(
            (t, i) => `
              <div class="security-item">
                <div class="security-icon">${i + 1}</div>
                <div>
                  <strong>${t.description || "Expense"}</strong>
                  <span>${t.category} · ${t.date || ""}</span>
                </div>
                <strong style="margin-left: auto">₹${Number(t.amount).toLocaleString("en-IN")}</strong>
              </div>
            `,
          )
          .join("")
      : '<div class="empty-state">No transactions yet.</div>';
  }

  const months = {};
  tx.forEach((t) => {
    const key = (t.date || "").slice(0, 7) || "Unknown";
    months[key] = (months[key] || 0) + Number(t.amount || 0);
  });

  let monthHtml = "";
  for (const [m, v] of Object.entries(months).sort().reverse()) {
    monthHtml += `
      <div class="settings-row">
        <div>
          <div class="settings-row-title">${m}</div>
          <div class="settings-row-sub">Recorded spending for this month</div>
        </div>
        <strong>₹${v.toLocaleString("en-IN")}</strong>
      </div>
    `;
  }

  const monthReportEl = document.getElementById("monthReport");
  if (monthReportEl) {
    monthReportEl.innerHTML =
      monthHtml ||
      '<div class="empty-state">Add a transaction to generate a report.</div>';
  }

  const exportBtn = document.getElementById("exportReport");
  if (exportBtn) {
    exportBtn.onclick = () => {
      const data = `ExpenseGuard Report\nTotal Spending,₹${total}\nAverage,₹${amounts.length ? total / amounts.length : 0}\nTop Category,${cats[0]?.[0] || "—"}\nHighest Expense,₹${amounts.length ? Math.max(...amounts) : 0}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([data], { type: "text/plain" }));
      a.download = "expenseguard-report.txt";
      a.click();
      toast("Report exported");
    };
  }
});

function toast(message) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
