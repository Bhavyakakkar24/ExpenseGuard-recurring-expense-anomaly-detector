// ============================================================
// EXPENSEGUARD — CATEGORIES JAVASCRIPT
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  const tx = getTransactions().map((t) => ({
    ...t,
    amount: Number(t.amount) || 0,
  }));

  const icons = {
    Food: "🍜",
    Transport: "🚕",
    Shopping: "🛍️",
    Utilities: "💡",
    Rent: "🏠",
    "Mobile / Internet": "📱",
    Entertainment: "🎬",
    Healthcare: "💊",
    Education: "📚",
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
    if (!groups[t.category]) {
      groups[t.category] = { total: 0, count: 0, items: [] };
    }
    groups[t.category].total += t.amount;
    groups[t.category].count++;
    groups[t.category].items.push(t);
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
      const el = document.createElement("article");
      el.className = "category-tile";
      el.innerHTML = `
        <div class="tile-top">
          <div class="category-icon">${icons[e.name] || "✨"}</div>
          <span class="category-percent">${pct.toFixed(1)}%</span>
        </div>
        <h3>${e.name}</h3>
        <div class="category-count">${e.count} transaction${e.count === 1 ? "" : "s"}</div>
        <div class="category-total">${money(e.total)}</div>
        <div class="category-progress">
          <span style="width: ${Math.max(3, pct)}%"></span>
        </div>
        <div class="category-foot">
          <span>Highest</span>
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
