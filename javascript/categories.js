function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeCategoryName(rawCat, description) {
  let cat = rawCat ? String(rawCat).trim() : "";
  if (!cat || !isNaN(Number(cat))) {
    let desc = description ? String(description).trim() : "";
    if (desc && isNaN(Number(desc))) {
      const lower = desc.toLowerCase();
      if (lower.includes("food") || lower.includes("zomato") || lower.includes("swiggy") || lower.includes("dining") || lower.includes("lunch") || lower.includes("dinner") || lower.includes("cafe")) return "Dining";
      if (lower.includes("groc") || lower.includes("supermarket") || lower.includes("mart")) return "Groceries";
      if (lower.includes("cab") || lower.includes("uber") || lower.includes("ride") || lower.includes("auto") || lower.includes("transport")) return "Transport";
      if (lower.includes("bill") || lower.includes("electr") || lower.includes("water") || lower.includes("wifi") || lower.includes("utilit")) return "Utilities";
      if (lower.includes("shop") || lower.includes("cloth") || lower.includes("shoe") || lower.includes("phone")) return "Shopping";
      if (lower.includes("stream") || lower.includes("netflix") || lower.includes("subsc")) return "Subscriptions";
      return desc;
    }
    return "Other";
  }
  return cat;
}

document.addEventListener("DOMContentLoaded", function () {
  const rawTx = typeof getTransactions === "function" ? getTransactions() : [];
  let updatedAny = false;

  const tx = rawTx.map((t) => {
    const amount = Number(t.amount) || 0;
    const cleanCat = sanitizeCategoryName(t.category, t.description);
    if (cleanCat !== t.category) {
      t.category = cleanCat;
      updatedAny = true;
    }
    return {
      ...t,
      category: cleanCat,
      amount: amount,
    };
  });

  if (updatedAny && typeof saveTransactions === "function") {
    saveTransactions(rawTx);
  }

  const icons = {
    Food: "🍜",
    Dining: "🍜",
    Transport: "🚕",
    Shopping: "🛍️",
    Utilities: "💡",
    Rent: "🏠",
    "Mobile / Internet": "📱",
    Entertainment: "🎬",
    Healthcare: "💊",
    Education: "📚",
    Subscriptions: "💳",
    Groceries: "🛒",
    Other: "✨",
  };

  const palette = [
    "#3f7ff4",
    "#32d9c1",
    "#f6a623",
    "#9b7cff",
    "#ef6b9b",
    "#7c8ca5",
    "#35b7ff",
    "#8fd14f",
  ];

  const groups = {};
  tx.forEach((t) => {
    const catName = t.category || "Other";
    if (!groups[catName]) {
      groups[catName] = { total: 0, count: 0, items: [] };
    }
    groups[catName].total += t.amount;
    groups[catName].count++;
    groups[catName].items.push(t);
  });

  const entries = Object.entries(groups).map(([name, v]) => ({
    name,
    ...v,
  }));

  const grand = entries.reduce((s, e) => s + e.total, 0);

  const money = (n) =>
    "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const sumTotalEl = document.getElementById("sumTotal");
  const sumCatEl = document.getElementById("sumCategories");
  const sumAvgEl = document.getElementById("sumAverage");
  const sumTopEl = document.getElementById("sumTop");
  const sumTopHintEl = document.getElementById("sumTopHint");
  const donutTotalEl = document.getElementById("donutTotal");

  if (sumTotalEl) sumTotalEl.textContent = money(grand);
  if (sumCatEl) sumCatEl.textContent = entries.length;
  if (sumAvgEl) sumAvgEl.textContent = money(entries.length ? grand / entries.length : 0);

  const top = entries.slice().sort((a, b) => b.total - a.total)[0];
  if (sumTopEl) sumTopEl.textContent = top ? top.name : "—";
  if (sumTopHintEl) {
    sumTopHintEl.textContent = top ? money(top.total) + " spent" : "No data yet";
  }
  if (donutTotalEl) donutTotalEl.textContent = money(grand);

  function render() {
    const q = document
      .getElementById("categorySearch")
      .value.toLowerCase()
      .trim();
    const sort = document.getElementById("categorySort").value;

    let list = entries.filter((e) => e.name.toLowerCase().includes(q));

    if (sort === "amount") list.sort((a, b) => b.total - a.total);
    if (sort === "count") list.sort((a, b) => b.count - a.count);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));

    const grid = document.getElementById("categoryGrid");
    grid.innerHTML = "";

    if (!list.length) {
      grid.innerHTML =
        '<div class="card empty-state" style="grid-column: 1 / -1"><div class="empty-icon">📊</div><h3>No matching category</h3><p>Try another search or add a new transaction.</p></div>';
      return;
    }

    list.forEach((e) => {
      const pct = grand ? (e.total / grand) * 100 : 0;
      const topTx = e.items.slice().sort((a, b) => b.amount - a.amount)[0];
      const descText = topTx && topTx.description ? topTx.description : "Expense item";

      const el = document.createElement("article");
      el.className = "category-tile";
      el.innerHTML = `
        <div class="tile-top">
          <div class="category-icon">${icons[e.name] || "✨"}</div>
          <span class="category-percent">${pct.toFixed(1)}%</span>
        </div>
        <h3>${escapeHTML(e.name)}</h3>
        <div class="category-count">${e.count} transaction${e.count === 1 ? "" : "s"}</div>
        <div class="category-total">${money(e.total)}</div>
        <div class="category-progress">
          <span style="width: ${Math.max(3, pct)}%"></span>
        </div>
        <div class="category-desc" style="margin-top: 10px; padding: 6px 10px; background: rgba(255, 255, 255, 0.04); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 12px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%; color: #e2e8f0; font-weight: 500;" title="${escapeHTML(descText)}">
            📝 ${escapeHTML(descText)}
          </span>
          <span style="font-size: 10px; color: #64748b; flex-shrink: 0;">Top Expense</span>
        </div>
        <div class="category-foot" style="margin-top: 8px;">
          <span>Highest Expense Amount</span>
          <strong>${topTx ? money(topTx.amount) : "₹0"}</strong>
        </div>
      `;
      grid.appendChild(el);
    });
  }

  function renderInsights() {
    const box = document.getElementById("categoryInsights");
    if (!entries.length) {
      box.innerHTML =
        '<div class="insight-item"><strong>Start tracking</strong><p>Add expenses to generate category insights automatically.</p></div>';
      return;
    }

    const sorted = entries.slice().sort((a, b) => b.total - a.total);
    const topCat = sorted[0];
    const lowCat = sorted[sorted.length - 1];
    const largestCount = entries
      .slice()
      .sort((a, b) => b.count - a.count)[0];

    box.innerHTML = `
      <div class="insight-item">
        <strong>🏆 ${topCat.name} leads your spending</strong>
        <p>${money(topCat.total)} is ${((topCat.total / grand) * 100).toFixed(1)}% of your recorded spending.</p>
      </div>
      <div class="insight-item">
        <strong>📌 ${largestCount.name} has the most transactions</strong>
        <p>${largestCount.count} transaction${largestCount.count === 1 ? "" : "s"} recorded in this category.</p>
      </div>
      <div class="insight-item">
        <strong>💡 Smallest category: ${lowCat.name}</strong>
        <p>${money(lowCat.total)} spent so far. Review it when planning your next budget.</p>
      </div>
    `;
  }

  const sortedForChart = entries.slice().sort((a, b) => b.total - a.total);
  const stops = [];
  let acc = 0;

  sortedForChart.forEach((e, i) => {
    const p = grand ? (e.total / grand) * 100 : 0;
    stops.push(`${palette[i % palette.length]} ${acc}% ${acc + p}%`);
    acc += p;
  });

  const donut = document.getElementById("donut");
  if (donut) {
    donut.style.background = stops.length
      ? `conic-gradient(${stops.join(",")})`
      : "#162a46";
  }

  const legendBox = document.getElementById("legend");
  if (legendBox) {
    if (!sortedForChart.length) {
      legendBox.innerHTML =
        '<div style="color: var(--muted); font-size: 12px; text-align: center; padding: 24px 0">No spending data yet</div>';
    } else {
      legendBox.innerHTML = sortedForChart
        .map((e, i) => {
          const color = palette[i % palette.length];
          const pct = grand ? ((e.total / grand) * 100).toFixed(1) : "0.0";
          return `
            <div class="legend-item">
              <div class="legend-left">
                <span class="legend-dot" style="background: ${color}"></span>
                <span class="legend-name">${icons[e.name] || "✨"} ${e.name}</span>
              </div>
              <div class="legend-right">
                <span class="legend-pct">${pct}%</span>
                <strong class="legend-amount">${money(e.total)}</strong>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }

  render();
  renderInsights();

  const catSearch = document.getElementById("categorySearch");
  const catSort = document.getElementById("categorySort");
  if (catSearch) catSearch.addEventListener("input", render);
  if (catSort) catSort.addEventListener("change", render);

  const u = typeof getCurrentUser === "function" ? getCurrentUser() : null;
  if (u) {
    const catUser = document.getElementById("catUser");
    const catInitials = document.getElementById("catInitials");
    if (catUser) catUser.textContent = u.name;
    if (catInitials && typeof getUserInitials === "function") {
      catInitials.textContent = getUserInitials(u.name);
    }
  }
});
