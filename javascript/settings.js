// ============================================================
// EXPENSEGUARD — SETTINGS JAVASCRIPT
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  if (typeof rememberLastPage === "function") {
    rememberLastPage("settings");
  }

  const currentUser =
    typeof getCurrentUser === "function" ? getCurrentUser() : null;
  const name =
    currentUser?.name ||
    localStorage.getItem("expenseGuardSetting_name") ||
    "Muskan Kapahi";
  const email =
    currentUser?.email ||
    localStorage.getItem("expenseGuardSetting_email") ||
    "";

  const setNameInput = document.getElementById("setName");
  const setEmailInput = document.getElementById("setEmail");
  const setCurrencyInput = document.getElementById("setCurrency");
  const defaultCategoryInput = document.getElementById("defaultCategory");
  const weekStartInput = document.getElementById("weekStart");

  if (setNameInput) setNameInput.value = name;
  if (setEmailInput) setEmailInput.value = email;
  if (setCurrencyInput) {
    setCurrencyInput.value =
      localStorage.getItem("expenseGuardSetting_currency") || "INR";
  }
  if (defaultCategoryInput) {
    defaultCategoryInput.value =
      localStorage.getItem("expenseGuardSetting_category") || "Food";
  }
  if (weekStartInput) {
    weekStartInput.value =
      localStorage.getItem("expenseGuardSetting_week") || "monday";
  }

  document
    .querySelectorAll(".settings-nav button[data-panel]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".settings-nav button[data-panel]")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".settings-panel")
          .forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const targetPanel = document.getElementById("panel-" + btn.dataset.panel);
        if (targetPanel) targetPanel.classList.add("active");
      });
    });

  const status = document.getElementById("saveStatus");
  function saved(message = "All changes saved") {
    if (status) {
      status.textContent = message;
      status.style.color = "#65e1a0";
      setTimeout(() => (status.textContent = "All changes saved"), 1800);
    }
    if (typeof toast === "function") toast(message);
  }

  document.querySelectorAll(".switch[data-key]").forEach((btn) => {
    const key = "expenseGuardSetting_" + btn.dataset.key;
    btn.classList.toggle("on", localStorage.getItem(key) !== "false");
    btn.addEventListener("click", () => {
      btn.classList.toggle("on");
      localStorage.setItem(key, String(btn.classList.contains("on")));
      saved("Preference updated");
    });
  });

  const currentTheme =
    (typeof getTheme === "function"
      ? getTheme()
      : localStorage.getItem("expenseGuardTheme")) || "navy";
  const themeBadge = document.getElementById("themeBadge");

  function updateThemeUI(t) {
    document.querySelectorAll("#themeSegmented button").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === t);
    });
    if (themeBadge) {
      themeBadge.textContent =
        t === "light" ? "LIGHT + INDIGO + TEAL" : "NAVY + INDIGO + TEAL";
    }
  }

  updateThemeUI(currentTheme);

  document.querySelectorAll("#themeSegmented button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = btn.dataset.theme;
      localStorage.setItem("expenseGuardTheme", selected);
      if (typeof applyTheme === "function") applyTheme(selected);
      updateThemeUI(selected);
      saved("Theme changed to " + (selected === "light" ? "Light" : "Navy"));
    });
  });

  const saveAccountBtn = document.getElementById("saveAccount");
  if (saveAccountBtn) {
    saveAccountBtn.onclick = () => {
      const n =
        (setNameInput ? setNameInput.value.trim() : "") || "Muskan Kapahi";
      const e = setEmailInput ? setEmailInput.value.trim() : "";

      localStorage.setItem("expenseGuardSetting_name", n);
      localStorage.setItem("expenseGuardSetting_email", e);
      if (setCurrencyInput) {
        localStorage.setItem(
          "expenseGuardSetting_currency",
          setCurrencyInput.value,
        );
      }

      const users = typeof getUsers === "function" ? getUsers() : [];
      const u = typeof getCurrentUser === "function" ? getCurrentUser() : null;

      if (u && Array.isArray(users)) {
        const idx = users.findIndex((x) => x.email === u.email);
        if (idx >= 0) {
          users[idx] = {
            ...users[idx],
            name: n,
            email: e || users[idx].email,
          };
          localStorage.setItem("expenseGuardUsers", JSON.stringify(users));
          localStorage.setItem(
            "expenseGuardCurrentUser",
            JSON.stringify(users[idx]),
          );
        }
      }
      saved("Profile saved");
    };
  }

  const resetAccountBtn = document.getElementById("resetAccount");
  if (resetAccountBtn) {
    resetAccountBtn.onclick = () => {
      if (setNameInput) setNameInput.value = name;
      if (setEmailInput) setEmailInput.value = email;
      if (setCurrencyInput) setCurrencyInput.value = "INR";
      saved("Profile reset");
    };
  }

  const savePrefsBtn = document.getElementById("savePrefs");
  if (savePrefsBtn) {
    savePrefsBtn.onclick = () => {
      if (defaultCategoryInput) {
        localStorage.setItem(
          "expenseGuardSetting_category",
          defaultCategoryInput.value,
        );
      }
      if (weekStartInput) {
        localStorage.setItem(
          "expenseGuardSetting_week",
          weekStartInput.value,
        );
      }
      saved("Preferences saved");
    };
  }

  const testAlertBtn = document.getElementById("testAlert");
  if (testAlertBtn) {
    testAlertBtn.onclick = () => {
      if (typeof toast === "function") toast("⚠ Anomaly alert preview");
    };
  }

  const exportDataBtn = document.getElementById("exportData");
  if (exportDataBtn) {
    exportDataBtn.onclick = () => {
      const rows =
        typeof getTransactions === "function" ? getTransactions() : [];
      if (!rows.length) {
        if (typeof toast === "function") toast("No transactions to export");
        return;
      }
      const headers = [
        "Date",
        "Description",
        "Category",
        "Amount",
        "Z-Score",
        "Anomaly",
      ];
      const lines = [
        headers.join(","),
        ...rows.map((t) =>
          [
            t.date,
            t.description,
            t.category,
            t.amount,
            t.zScore || 0,
            t.isAnomaly ? "Yes" : "No",
          ]
            .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
            .join(","),
        ),
      ];
      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "expenseguard-transactions.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      saved("CSV exported");
    };
  }

  const loadDemoBtn = document.getElementById("loadDemo");
  if (loadDemoBtn) {
    loadDemoBtn.onclick = () => {
      const data = [
        ["Food", "Zomato", 450],
        ["Transport", "Uber", 280],
        ["Shopping", "Amazon", 2499],
        ["Bills", "Electricity", 1560],
        ["Entertainment", "Netflix", 649],
        ["Food", "Cafe", 520],
        ["Transport", "Metro", 180],
        ["Healthcare", "Pharmacy", 720],
        ["Education", "Course Material", 1200],
        ["Food", "Weekend Dinner", 5000],
      ];
      const now = new Date();
      const demo = data.map((x, i) => ({
        id: Date.now() + i,
        date: new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10),
        category: x[0],
        description: x[1],
        amount: x[2],
      }));
      if (typeof saveTransactions === "function") saveTransactions(demo);
      saved("Demo data loaded");
      setTimeout(() => (location.href = "../dashboard.html"), 650);
    };
  }

  const clearDataBtn = document.getElementById("clearData");
  if (clearDataBtn) {
    clearDataBtn.onclick = () => {
      if (confirm("Delete all saved transactions? This cannot be undone.")) {
        if (typeof saveTransactions === "function") saveTransactions([]);
        saved("All transactions cleared");
      }
    };
  }

  const signOutBtn = document.getElementById("signOut");
  if (signOutBtn) {
    signOutBtn.onclick = () => {
      localStorage.removeItem("expenseGuardLoggedIn");
      localStorage.removeItem("expenseGuardCurrentUser");
      sessionStorage.clear();
      location.href = "signin.html";
    };
  }

  const runLabBtn = document.getElementById("runLab");
  if (runLabBtn) {
    runLabBtn.onclick = () => {
      const tx =
        typeof getTransactions === "function" ? getTransactions() : [];
      const amounts = tx.map((t) => Number(t.amount) || 0);
      const total = amounts.reduce((sum, n) => sum + n, 0);
      const highest = amounts.length ? Math.max(...amounts) : 0;
      const flagged = tx.filter((t) => t.isAnomaly).length;
      const categories = [...new Set(tx.map((t) => t.category))].sort();
      let loops = 0;
      for (let i = 0; i < tx.length; i++) {
        loops++;
      }
      const average = amounts.length ? total / amounts.length : 0;
      const labOutput = document.getElementById("labOutput");
      if (labOutput) {
        labOutput.className = "eval-lab";
        labOutput.innerHTML = `
          <strong style="color: #eef6ff">JavaScript lab complete ✓</strong>
          <p style="color: #91a6bf; margin: 7px 0 0">
            map() processed ${amounts.length} amounts · reduce() total ₹${total.toLocaleString("en-IN")} · filter() found ${flagged} anomalies · sort() found ${categories.length} categories · for loop iterated ${loops} records · average ₹${average.toFixed(2)} · highest ₹${highest.toLocaleString("en-IN")}
          </p>
        `;
      }
      saved("Evaluation lab executed");
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
