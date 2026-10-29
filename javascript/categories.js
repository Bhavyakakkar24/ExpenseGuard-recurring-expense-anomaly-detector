// ============================================================
// EXPENSEGUARD — CATEGORIES PAGE (CE-2 MONGODB PERSISTENT)
// Fetches saved categories from MongoDB Atlas & transactions from API,
// then computes and renders all category breakdowns and CRUD operations.
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
  // ── Icons & Palette ────────────────────────────────────────
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

  const money = (n) =>
    "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  // ── State variables ────────────────────────────────────────
  let entries = [];         // [{ id, name, icon, color, description, monthlyLimit, isPersisted, total, count, items[] }]
  let grand = 0;            // sum of all amounts
  let pendingDeleteId = null;
  let hasAutoInitialized = false;

  // ── Summary stat elements ─────────────────────────────────
  const sumTotalEl  = document.getElementById("sumTotal");
  const sumCatEl    = document.getElementById("sumCategories");
  const sumAvgEl    = document.getElementById("sumAverage");
  const sumTopEl    = document.getElementById("sumTop");
  const sumTopHintEl = document.getElementById("sumTopHint");
  const donutTotalEl = document.getElementById("donutTotal");

  // ── Alert helper ──────────────────────────────────────────
  const alertEl = document.getElementById("categoryAlert");
  const alertMsgEl = document.getElementById("categoryAlertMsg");
  const alertCloseBtn = document.getElementById("categoryAlertClose");

  let alertTimeout = null;
  function showAlert(message, type = "success") {
    if (!alertEl || !alertMsgEl) return;
    if (alertTimeout) clearTimeout(alertTimeout);

    alertEl.className = `category-alert alert-${type}`;
    alertMsgEl.textContent = message;
    alertEl.style.display = "flex";

    alertTimeout = setTimeout(() => {
      hideAlert();
    }, 6000);
  }

  function hideAlert() {
    if (alertEl) {
      alertEl.style.display = "none";
    }
  }

  if (alertCloseBtn) {
    alertCloseBtn.addEventListener("click", hideAlert);
  }

  // ── Show a loading state ──────────────────────────────────
  function showLoading() {
    const grid = document.getElementById("categoryGrid");
    if (grid) {
      grid.innerHTML = '<div class="card empty-state" style="grid-column: 1 / -1"><div class="empty-icon">⏳</div><h3>Loading categories…</h3><p>Fetching persistent category and transaction data from MongoDB Atlas.</p></div>';
    }
    if (sumTotalEl) sumTotalEl.textContent = "…";
    if (sumCatEl)   sumCatEl.textContent   = "…";
    if (sumAvgEl)   sumAvgEl.textContent   = "…";
  }

  // ── Show an API-error state ───────────────────────────────
  function showError(message) {
    const grid = document.getElementById("categoryGrid");
    if (grid) {
      grid.innerHTML = `<div class="card empty-state" style="grid-column: 1 / -1"><div class="empty-icon">⚠️</div><h3>Could not load categories</h3><p>${escapeHTML(message || "Network error. Please ensure the server is running.")}</p></div>`;
    }
    if (sumTotalEl)   sumTotalEl.textContent   = "—";
    if (sumCatEl)     sumCatEl.textContent      = "—";
    if (sumAvgEl)     sumAvgEl.textContent      = "—";
    if (sumTopEl)     sumTopEl.textContent      = "—";
    if (donutTotalEl) donutTotalEl.textContent  = "₹0";
  }

  // ── Compute derived state combining saved DB categories + raw transactions ──
  function buildDerivedState(rawTx, savedCats) {
    const categoryMap = {};

    // 1. Populate saved categories from MongoDB Atlas
    (savedCats || []).forEach((c) => {
      const key = (c.name || "").toLowerCase().trim();
      if (!key) return;
      categoryMap[key] = {
        id: c.id,
        name: c.name.trim(),
        icon: c.icon || icons[c.name.trim()] || "✨",
        color: c.color || "#3f7ff4",
        description: c.description || "",
        monthlyLimit: typeof c.monthlyLimit === "number" ? c.monthlyLimit : 0,
        total: 0,
        count: 0,
        items: [],
        isPersisted: true,
      };
    });

    // 2. Aggregate transactions from real records (preserves historical data)
    const tx = (rawTx || []).map((t) => ({
      ...t,
      category: sanitizeCategoryName(t.category, t.description),
      amount: Number(t.amount) || 0,
    }));

    tx.forEach((t) => {
      const catName = (t.category || "Other").trim();
      const key = catName.toLowerCase();
      if (!categoryMap[key]) {
        // Discovered category from transactions not yet explicitly in categories collection
        categoryMap[key] = {
          id: null,
          name: catName,
          icon: icons[catName] || "✨",
          color: "#3f7ff4",
          description: "",
          monthlyLimit: 0,
          total: 0,
          count: 0,
          items: [],
          isPersisted: false,
        };
      }
      categoryMap[key].total += t.amount;
      categoryMap[key].count++;
      categoryMap[key].items.push(t);
    });

    entries = Object.values(categoryMap);
    grand = entries.reduce((s, e) => s + e.total, 0);
  }

  // ── Update summary stats ──────────────────────────────────
  function renderSummary() {
    if (sumTotalEl)  sumTotalEl.textContent  = money(grand);
    if (sumCatEl)    sumCatEl.textContent     = entries.length;
    if (sumAvgEl)    sumAvgEl.textContent     = money(entries.length ? grand / entries.length : 0);
    if (donutTotalEl) donutTotalEl.textContent = money(grand);

    const activeWithSpending = entries.filter((e) => e.total > 0);
    const top = activeWithSpending.slice().sort((a, b) => b.total - a.total)[0];
    if (sumTopEl)     sumTopEl.textContent     = top ? top.name : "—";
    if (sumTopHintEl) sumTopHintEl.textContent = top ? money(top.total) + " spent" : "No data yet";
  }

  // ── Render category grid (respects search + sort) ─────────
  function render() {
    const q    = (document.getElementById("categorySearch")?.value || "").toLowerCase().trim();
    const sort = document.getElementById("categorySort")?.value || "amount";

    let list = entries.filter((e) => e.name.toLowerCase().includes(q));

    if (sort === "amount") list.sort((a, b) => b.total - a.total);
    if (sort === "count")  list.sort((a, b) => b.count - a.count);
    if (sort === "name")   list.sort((a, b) => a.name.localeCompare(b.name));

    const grid = document.getElementById("categoryGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (!list.length) {
      const emptyMsg = entries.length === 0
        ? "<h3>No categories found</h3><p>Click '+ Add Category' to create your first persistent category, or 'Sync from Transactions' to import existing categories.</p>"
        : "<h3>No matching category</h3><p>Try another search term.</p>";
      grid.innerHTML = `<div class="card empty-state" style="grid-column: 1 / -1"><div class="empty-icon">📊</div>${emptyMsg}</div>`;
      return;
    }

    list.forEach((e) => {
      const pct    = grand ? (e.total / grand) * 100 : 0;
      const topTx  = e.items.slice().sort((a, b) => b.amount - a.amount)[0];
      const descText = topTx?.description ? topTx.description : (e.description || "No description");

      const badgeHtml = e.isPersisted
        ? '<span class="category-db-badge db-saved" title="Stored persistently in MongoDB Atlas categories collection">MongoDB Atlas</span>'
        : '<span class="category-db-badge db-implicit" title="Discovered from transactions; not yet saved in categories collection">Transaction Only</span>';

      const actionsHtml = e.isPersisted
        ? `
          <div class="category-tile-actions">
            <button type="button" class="tile-action-btn edit-cat-btn"
              data-id="${escapeHTML(e.id)}"
              data-name="${escapeHTML(e.name)}"
              data-icon="${escapeHTML(e.icon)}"
              data-color="${escapeHTML(e.color)}"
              data-limit="${e.monthlyLimit || 0}"
              data-desc="${escapeHTML(e.description)}"
              title="Edit Category Definition">✏️ Edit</button>
            <button type="button" class="tile-action-btn delete delete-cat-btn"
              data-id="${escapeHTML(e.id)}"
              data-name="${escapeHTML(e.name)}"
              title="Delete Category from MongoDB">🗑️</button>
          </div>
        `
        : `
          <div class="category-tile-actions">
            <button type="button" class="tile-action-btn save-implicit-btn"
              data-name="${escapeHTML(e.name)}"
              data-icon="${escapeHTML(e.icon)}"
              title="Save this category definition to MongoDB Atlas">💾 Save to DB</button>
          </div>
        `;

      let limitHtml = "";
      if (e.monthlyLimit > 0) {
        const limitPct = Math.min(100, (e.total / e.monthlyLimit) * 100);
        const limitColor = limitPct > 100 ? "#ef4444" : limitPct > 80 ? "#f59e0b" : "#10b981";
        limitHtml = `
          <div class="category-limit-info" style="margin-top: 10px; font-size: 11px;">
            <span style="color: #94a3b8;">Limit: <strong>${money(e.monthlyLimit)}</strong></span>
            <span style="color: ${limitColor}; font-weight: 700;">${limitPct.toFixed(0)}% used</span>
          </div>
        `;
      }

      const el = document.createElement("article");
      el.className = "category-tile";
      el.innerHTML = `
        <div class="tile-top">
          <div class="category-icon" style="background: ${e.color ? e.color + '22' : '#142e53'}; border-color: ${e.color || '#274d7c'};">
            ${escapeHTML(e.icon || icons[e.name] || "✨")}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${badgeHtml}
            <span class="category-percent">${pct.toFixed(1)}%</span>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
          <h3 style="margin: 0; font-size: 17px; color: #f0f6ff;">${escapeHTML(e.name)}</h3>
          ${actionsHtml}
        </div>
        <div class="category-count" style="margin-top: 4px;">${e.count} transaction${e.count === 1 ? "" : "s"}</div>
        <div class="category-total" style="color: ${e.color || '#ffffff'};">${money(e.total)}</div>
        <div class="category-progress">
          <span style="width: ${Math.max(3, pct)}%; background: ${e.color ? `linear-gradient(90deg, ${e.color}, #32d9c1)` : 'linear-gradient(90deg, #477ff3, #32d9c1)'};"></span>
        </div>
        ${limitHtml}
        <div class="category-desc" style="margin-top: 10px; padding: 6px 10px; background: rgba(255,255,255,0.04); border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%; color: #e2e8f0; font-weight: 500;" title="${escapeHTML(descText)}">
            📝 ${escapeHTML(descText)}
          </span>
          <span style="font-size: 10px; color: #64748b; flex-shrink: 0;">${topTx ? "Top Expense" : "Detail"}</span>
        </div>
        <div class="category-foot" style="margin-top: 8px;">
          <span>Highest Expense Amount</span>
          <strong>${topTx ? money(topTx.amount) : "₹0"}</strong>
        </div>
      `;
      grid.appendChild(el);
    });

    // Attach event listeners for card action buttons
    grid.querySelectorAll(".edit-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        openEditModal({
          id: btn.dataset.id,
          name: btn.dataset.name,
          icon: btn.dataset.icon,
          color: btn.dataset.color,
          monthlyLimit: btn.dataset.limit,
          description: btn.dataset.desc,
        });
      });
    });

    grid.querySelectorAll(".delete-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        openDeleteModal(btn.dataset.id, btn.dataset.name);
      });
    });

    grid.querySelectorAll(".save-implicit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;
          btn.textContent = "Saving…";
          await window.ExpenseGuardAPI.createCategory({
            name: btn.dataset.name,
            icon: btn.dataset.icon,
          });
          showAlert(`Category '${btn.dataset.name}' saved to MongoDB Atlas!`, "success");
          await loadCategories();
        } catch (err) {
          showAlert(err.message || "Failed to save category.", "error");
          btn.disabled = false;
          btn.textContent = "💾 Save to DB";
        }
      });
    });
  }

  // ── Render category insights ──────────────────────────────
  function renderInsights() {
    const box = document.getElementById("categoryInsights");
    if (!box) return;

    if (!entries.length) {
      box.innerHTML = '<div class="insight-item"><strong>Start tracking</strong><p>Add expenses or create categories to generate category insights automatically.</p></div>';
      return;
    }

    const activeEntries = entries.filter((e) => e.total > 0);
    if (!activeEntries.length) {
      box.innerHTML = `
        <div class="insight-item">
          <strong>📂 ${entries.length} Categories Defined</strong>
          <p>You have defined ${entries.length} persistent categories in MongoDB Atlas. Transactions recorded in these categories will appear here automatically.</p>
        </div>
      `;
      return;
    }

    const sorted      = activeEntries.slice().sort((a, b) => b.total - a.total);
    const topCat      = sorted[0];
    const lowCat      = sorted[sorted.length - 1];
    const largestCount = activeEntries.slice().sort((a, b) => b.count - a.count)[0];

    box.innerHTML = `
      <div class="insight-item">
        <strong>🏆 ${escapeHTML(topCat.name)} leads your spending</strong>
        <p>${money(topCat.total)} is ${((topCat.total / grand) * 100).toFixed(1)}% of your recorded spending.</p>
      </div>
      <div class="insight-item">
        <strong>📌 ${escapeHTML(largestCount.name)} has the most transactions</strong>
        <p>${largestCount.count} transaction${largestCount.count === 1 ? "" : "s"} recorded in this category.</p>
      </div>
      <div class="insight-item">
        <strong>💡 Smallest active category: ${escapeHTML(lowCat.name)}</strong>
        <p>${money(lowCat.total)} spent so far. Review it when planning your next budget.</p>
      </div>
    `;
  }

  // ── Render donut chart & legend ───────────────────────────
  function renderChart() {
    const sortedForChart = entries
      .filter((e) => e.total > 0)
      .slice()
      .sort((a, b) => b.total - a.total);

    const stops = [];
    let acc = 0;

    sortedForChart.forEach((e, i) => {
      const p = grand ? (e.total / grand) * 100 : 0;
      const color = e.color || palette[i % palette.length];
      stops.push(`${color} ${acc}% ${acc + p}%`);
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
        legendBox.innerHTML = '<div style="color: var(--muted); font-size: 12px; text-align: center; padding: 24px 0">No spending data yet</div>';
      } else {
        legendBox.innerHTML = sortedForChart
          .map((e, i) => {
            const color = e.color || palette[i % palette.length];
            const pct   = grand ? ((e.total / grand) * 100).toFixed(1) : "0.0";
            return `
              <div class="legend-item">
                <div class="legend-left">
                  <span class="legend-dot" style="background: ${color}"></span>
                  <span class="legend-name">${escapeHTML(e.icon || icons[e.name] || "✨")} ${escapeHTML(e.name)}</span>
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
  }

  // ── Full re-render ─────────────────────────────────────────
  function renderAll() {
    renderSummary();
    render();
    renderInsights();
    renderChart();
  }

  // ── Profile header ────────────────────────────────────────
  function loadProfile() {
    const u = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    if (u) {
      const catUser     = document.getElementById("catUser");
      const catInitials = document.getElementById("catInitials");
      if (catUser) catUser.textContent = u.name || u.displayName || "My Account";
      if (catInitials && typeof getUserInitials === "function") {
        catInitials.textContent = getUserInitials(u.name || u.displayName || "");
      }
    }
  }

  // ── Modal Handling: Add / Edit Category ─────────────────────
  const categoryModal = document.getElementById("categoryModal");
  const categoryForm = document.getElementById("categoryForm");
  const modalCategoryId = document.getElementById("modalCategoryId");
  const modalCategoryName = document.getElementById("modalCategoryName");
  const modalCategoryIcon = document.getElementById("modalCategoryIcon");
  const modalCategoryColor = document.getElementById("modalCategoryColor");
  const modalCategoryLimit = document.getElementById("modalCategoryLimit");
  const modalCategoryDescription = document.getElementById("modalCategoryDescription");
  const categoryModalTitle = document.getElementById("categoryModalTitle");
  const categoryModalLabel = document.getElementById("categoryModalLabel");
  const saveCategoryModalBtn = document.getElementById("saveCategoryModalBtn");
  const closeCategoryModalBtn = document.getElementById("closeCategoryModalBtn");
  const cancelCategoryModalBtn = document.getElementById("cancelCategoryModalBtn");
  const openAddCategoryBtn = document.getElementById("openAddCategoryBtn");
  const syncCategoriesBtn = document.getElementById("syncCategoriesBtn");

  function openAddModal() {
    if (!categoryModal) return;
    modalCategoryId.value = "";
    categoryForm.reset();
    modalCategoryColor.value = "#3f7ff4";
    categoryModalTitle.textContent = "Add Category";
    categoryModalLabel.textContent = "NEW MONGODB ATLAS CATEGORY";
    saveCategoryModalBtn.textContent = "Create Category";
    categoryModal.style.display = "flex";
    categoryModal.classList.add("show");
    modalCategoryName.focus();
  }

  function openEditModal(cat) {
    if (!categoryModal) return;
    modalCategoryId.value = cat.id || "";
    modalCategoryName.value = cat.name || "";
    modalCategoryIcon.value = cat.icon || "";
    modalCategoryColor.value = cat.color || "#3f7ff4";
    modalCategoryLimit.value = cat.monthlyLimit && cat.monthlyLimit > 0 ? cat.monthlyLimit : "";
    modalCategoryDescription.value = cat.description || "";
    categoryModalTitle.textContent = "Edit Category";
    categoryModalLabel.textContent = "UPDATE MONGODB CATEGORY";
    saveCategoryModalBtn.textContent = "Update Category";
    categoryModal.style.display = "flex";
    categoryModal.classList.add("show");
    modalCategoryName.focus();
  }

  function closeCategoryModal() {
    if (categoryModal) {
      categoryModal.style.display = "none";
      categoryModal.classList.remove("show");
    }
  }

  if (openAddCategoryBtn) openAddCategoryBtn.addEventListener("click", openAddModal);
  if (closeCategoryModalBtn) closeCategoryModalBtn.addEventListener("click", closeCategoryModal);
  if (cancelCategoryModalBtn) cancelCategoryModalBtn.addEventListener("click", closeCategoryModal);

  // Close modals when clicking backdrop
  window.addEventListener("click", (e) => {
    if (e.target === categoryModal) closeCategoryModal();
    if (e.target === deleteCategoryModal) closeDeleteModal();
  });

  // Handle Form Submission (Create or Update)
  if (categoryForm) {
    categoryForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = modalCategoryId.value.trim();
      const name = modalCategoryName.value.trim();
      const icon = modalCategoryIcon.value.trim();
      const color = modalCategoryColor.value.trim();
      const monthlyLimit = modalCategoryLimit.value !== "" ? Number(modalCategoryLimit.value) : 0;
      const description = modalCategoryDescription.value.trim();

      if (!name) {
        showAlert("Category name is required.", "error");
        return;
      }

      const payload = {
        name,
        icon: icon || undefined,
        color: color || undefined,
        monthlyLimit: isNaN(monthlyLimit) ? 0 : monthlyLimit,
        description,
      };

      try {
        saveCategoryModalBtn.disabled = true;
        saveCategoryModalBtn.textContent = "Saving…";

        if (id) {
          // Update existing category
          await window.ExpenseGuardAPI.updateCategory(id, payload);
          showAlert(`Category '${name}' updated successfully in MongoDB Atlas!`, "success");
        } else {
          // Create new category
          await window.ExpenseGuardAPI.createCategory(payload);
          showAlert(`Category '${name}' created successfully in MongoDB Atlas!`, "success");
        }

        closeCategoryModal();
        await loadCategories();
      } catch (err) {
        console.error("Save category error:", err);
        showAlert(err.message || "Failed to save category. Please try again.", "error");
      } finally {
        saveCategoryModalBtn.disabled = false;
        saveCategoryModalBtn.textContent = id ? "Update Category" : "Create Category";
      }
    });
  }

  // ── Modal Handling: Delete Category ────────────────────────
  const deleteCategoryModal = document.getElementById("deleteCategoryModal");
  const deleteCategoryPrompt = document.getElementById("deleteCategoryPrompt");
  const confirmDeleteCategoryBtn = document.getElementById("confirmDeleteCategoryBtn");
  const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");
  const cancelDeleteModalBtn = document.getElementById("cancelDeleteModalBtn");

  function openDeleteModal(id, name) {
    if (!deleteCategoryModal) return;
    pendingDeleteId = id;
    if (deleteCategoryPrompt) {
      deleteCategoryPrompt.textContent = `Are you sure you want to delete "${name}" from MongoDB Atlas?`;
    }
    deleteCategoryModal.style.display = "flex";
    deleteCategoryModal.classList.add("show");
  }

  function closeDeleteModal() {
    if (deleteCategoryModal) {
      deleteCategoryModal.style.display = "none";
      deleteCategoryModal.classList.remove("show");
    }
    pendingDeleteId = null;
  }

  if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
  if (cancelDeleteModalBtn) cancelDeleteModalBtn.addEventListener("click", closeDeleteModal);

  if (confirmDeleteCategoryBtn) {
    confirmDeleteCategoryBtn.addEventListener("click", async () => {
      if (!pendingDeleteId) return;

      try {
        confirmDeleteCategoryBtn.disabled = true;
        confirmDeleteCategoryBtn.textContent = "Deleting…";

        await window.ExpenseGuardAPI.deleteCategory(pendingDeleteId);
        showAlert("Category deleted from MongoDB Atlas. Associated transactions are preserved.", "success");
        closeDeleteModal();
        await loadCategories();
      } catch (err) {
        console.error("Delete category error:", err);
        showAlert(err.message || "Failed to delete category.", "error");
      } finally {
        confirmDeleteCategoryBtn.disabled = false;
        confirmDeleteCategoryBtn.textContent = "Delete Category";
      }
    });
  }

  // ── Manual Sync / Initialization from Transactions ─────────
  if (syncCategoriesBtn) {
    syncCategoriesBtn.addEventListener("click", async () => {
      try {
        syncCategoriesBtn.disabled = true;
        syncCategoriesBtn.innerHTML = "<span>⏳</span> Syncing…";

        const result = await window.ExpenseGuardAPI.initCategories();
        const count = result.initializedCount || 0;
        showAlert(`Sync completed: ${count} new category document${count === 1 ? "" : "s"} created in MongoDB Atlas.`, "success");
        await loadCategories();
      } catch (err) {
        console.error("Category sync error:", err);
        showAlert(err.message || "Failed to sync categories from transactions.", "error");
      } finally {
        syncCategoriesBtn.disabled = false;
        syncCategoriesBtn.innerHTML = "<span>⚡</span> Sync from Transactions";
      }
    });
  }

  // ── Event listeners (search + sort) ──────────────────────
  const catSearch = document.getElementById("categorySearch");
  const catSort   = document.getElementById("categorySort");
  if (catSearch) catSearch.addEventListener("input", render);
  if (catSort)   catSort.addEventListener("change", render);

  // ── Main entry point: loadCategories ──────────────────────
  showLoading();
  loadProfile();

  async function loadCategories() {
    try {
      let rawTx = [];
      let savedCats = [];

      // 1. Fetch transactions (from API / cache)
      if (typeof window.fetchTransactions === "function") {
        rawTx = await window.fetchTransactions(true);
      } else if (typeof getTransactions === "function") {
        rawTx = getTransactions();
      }

      // 2. Fetch saved categories from MongoDB Atlas
      if (window.ExpenseGuardAPI && typeof window.ExpenseGuardAPI.getCategories === "function") {
        try {
          savedCats = await window.ExpenseGuardAPI.getCategories();
        } catch (apiCatErr) {
          console.warn("Could not load categories from API:", apiCatErr.message);
        }
      }

      // 3. Auto-initialize missing category documents if saved collection is empty but user has transactions
      if (
        !hasAutoInitialized &&
        savedCats.length === 0 &&
        rawTx.length > 0 &&
        window.ExpenseGuardAPI &&
        typeof window.ExpenseGuardAPI.initCategories === "function"
      ) {
        hasAutoInitialized = true;
        try {
          const initRes = await window.ExpenseGuardAPI.initCategories();
          if (initRes && Array.isArray(initRes.data) && initRes.data.length > 0) {
            savedCats = initRes.data;
          }
        } catch (initErr) {
          console.warn("Auto-initialization of categories notice:", initErr.message);
        }
      }

      buildDerivedState(rawTx, savedCats);
      renderAll();
      loadProfile();

    } catch (err) {
      console.error("Categories: failed to load categories & transactions:", err);
      showError(err.message || "Could not connect to the ExpenseGuard backend. Ensure the server is running on port 5000.");
    }
  }

  loadCategories();

  // Expose for firebase-auth.js re-render callback
  window.renderCategories = function () {
    loadCategories();
  };
});
