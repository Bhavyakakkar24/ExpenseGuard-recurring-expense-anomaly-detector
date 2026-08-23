// ============================================================
// EXPENSEGUARD — BUDGETS JAVASCRIPT
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  const KEY = "expenseGuardBudgets";

  if (typeof rememberLastPage === "function") {
    rememberLastPage("budgets");
  }

  const getBudgets = () => JSON.parse(localStorage.getItem(KEY) || "{}");
  const saveBudgets = (data) => localStorage.setItem(KEY, JSON.stringify(data));

  function renderBudgets() {
    const budgets = getBudgets();
    const tx = typeof getTransactions === "function" ? getTransactions() : [];
    const box = document.getElementById("budgetList");

    if (!box) return;

    const cats = Object.keys(budgets);

    if (!cats.length) {
      box.innerHTML =
        '<div class="empty-state"><strong>No budgets yet</strong><p>Create your first category budget above.</p></div>';
      return;
    }

    box.innerHTML = cats
      .map((c) => {
        const spent = tx
          .filter((t) => t.category === c)
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const limit = Number(budgets[c]);
        const pct = Math.min(100, limit ? (spent / limit) * 100 : 0);
        const color =
          pct >= 100 ? "#fb7185" : pct >= 80 ? "#f6b84a" : "#27d3bd";

        return `
          <div class="settings-row">
            <div style="flex: 1">
              <div class="settings-row-title">${c}</div>
              <div class="settings-row-sub">₹${spent.toLocaleString("en-IN")} spent of ₹${limit.toLocaleString("en-IN")}</div>
              <div class="progress" style="margin-top: 8px">
                <div class="progress-bar" style="width: ${pct}%; background: ${color} !important"></div>
              </div>
            </div>
            <div class="settings-control">
              <strong style="color: ${color}">${pct.toFixed(0)}%</strong>
              <button class="btn-danger delete-budget" data-category="${c}" style="padding: 7px 9px">×</button>
            </div>
          </div>
        `;
      })
      .join("");

    box.querySelectorAll(".delete-budget").forEach((btn) => {
      btn.onclick = () => {
        const current = getBudgets();
        delete current[btn.dataset.category];
        saveBudgets(current);
        renderBudgets();
        toast("Budget removed");
      };
    });
  }

  const saveBtn = document.getElementById("saveBudget");
  if (saveBtn) {
    saveBtn.onclick = () => {
      const catSelect = document.getElementById("budgetCategory");
      const amountInput = document.getElementById("budgetAmount");

      const category = catSelect ? catSelect.value : "";
      const amount = Number(amountInput ? amountInput.value : 0);

      if (!amount || amount <= 0) {
        toast("Enter a valid budget amount");
        return;
      }

      const current = getBudgets();
      current[category] = amount;
      saveBudgets(current);

      if (amountInput) amountInput.value = "";
      renderBudgets();
      toast("Budget saved");
    };
  }

  renderBudgets();
});

function toast(message) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
