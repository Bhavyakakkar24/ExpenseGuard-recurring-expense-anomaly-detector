// ============================================================
// EXPENSEGUARD — SECURE STANDALONE ADMIN CONSOLE JAVASCRIPT
// ============================================================

const FAKE_DEMO_USERS = [
  { id: "demo_u1", name: "Aarav Sharma", email: "aarav.sharma@techcorp.in", createdAt: "2023-08-14", isDemo: true },
  { id: "demo_u2", name: "Priya Patel", email: "priya.patel@finbridge.org", createdAt: "2023-08-19", isDemo: true },
  { id: "demo_u3", name: "Vikram Malhotra", email: "vikram.m@analyticslab.co", createdAt: "2023-08-25", isDemo: true },
  { id: "demo_u4", name: "Ananya Iyer", email: "ananya.iyer@cloudmatrix.io", createdAt: "2023-09-02", isDemo: true },
  { id: "demo_u5", name: "Rohan Gupta", email: "rohan.gupta@finpulse.net", createdAt: "2023-09-08", isDemo: true },
  { id: "demo_u6", name: "Sneha Mukherjee", email: "sneha.m@datapoint.org", createdAt: "2023-09-14", isDemo: true },
  { id: "demo_u7", name: "Aditya Verma", email: "aditya.verma@nexusflow.in", createdAt: "2023-09-20", isDemo: true },
  { id: "demo_u8", name: "Kavita Reddy", email: "kavita.reddy@quantix.io", createdAt: "2023-09-27", isDemo: true },
  { id: "demo_u9", name: "Siddharth Nair", email: "siddharth.n@cybervault.com", createdAt: "2023-10-04", isDemo: true },
  { id: "demo_u10", name: "Meera Deshmukh", email: "meera.d@fintechglobal.com", createdAt: "2023-10-11", isDemo: true },
  { id: "demo_u11", name: "Arjun Mehta", email: "arjun.mehta@datashield.in", createdAt: "2023-10-18", isDemo: true },
  { id: "demo_u12", name: "Tanvi Saxena", email: "tanvi.saxena@algocore.io", createdAt: "2023-10-25", isDemo: true },
  { id: "demo_u13", name: "Kunal Singhania", email: "kunal.s@venturematrix.co", createdAt: "2023-11-01", isDemo: true },
  { id: "demo_u14", name: "Deepika Rao", email: "deepika.rao@intellinet.org", createdAt: "2023-11-08", isDemo: true },
  { id: "demo_u15", name: "Varun Kapoor", email: "varun.kapoor@syncflow.in", createdAt: "2023-11-15", isDemo: true }
];

document.addEventListener("DOMContentLoaded", function () {
  checkAdminAuthentication();
  initializeAdminTheme();
  initializeAdminTabs();
  initializeAdminLogout();
  refreshAdminDashboard();
  initializeDemoAnalytics();
  initializeClearDemoData();
});

// ============================================================
// ADMIN THEME TOGGLE (NAVY DARK / LIGHT MODE)
// ============================================================

function initializeAdminTheme() {
  const toggleBtn = document.getElementById("adminThemeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");

  function updateThemeDisplay(theme) {
    const isLight = theme === "light";
    if (themeIcon) themeIcon.textContent = isLight ? "☀️" : "🌙";
    if (themeText) themeText.textContent = isLight ? "Light" : "Navy";
  }

  const currentTheme = localStorage.getItem("expenseGuardTheme") || "navy";
  updateThemeDisplay(currentTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      const isCurrentlyLight = document.documentElement.getAttribute("data-theme") === "light";
      const newTheme = isCurrentlyLight ? "navy" : "light";
      localStorage.setItem("expenseGuardTheme", newTheme);
      if (typeof applyTheme === "function") {
        applyTheme(newTheme);
      } else {
        if (newTheme === "light") {
          document.documentElement.setAttribute("data-theme", "light");
          if (document.body) document.body.classList.add("theme-light");
        } else {
          document.documentElement.removeAttribute("data-theme");
          if (document.body) document.body.classList.remove("theme-light");
        }
      }
      updateThemeDisplay(newTheme);
    });
  }
}

// ============================================================
// ADMIN AUTHENTICATION GUARD
// ============================================================

function checkAdminAuthentication() {
  const isAuth = sessionStorage.getItem("expenseGuardAdminAuth");
  if (isAuth !== "true") {
    window.location.replace("admin-login.html");
  }
}

// ============================================================
// TAB NAVIGATION (OVERVIEW VS SETTINGS)
// ============================================================

function initializeAdminTabs() {
  const navOverview = document.getElementById("navOverview");
  const navSettings = document.getElementById("navSettings");
  const panelOverview = document.getElementById("panelOverview");
  const panelSettings = document.getElementById("panelSettings");
  const heading = document.getElementById("adminPageHeading");
  const subheading = document.getElementById("adminPageSubheading");

  function showTab(tab) {
    if (tab === "settings") {
      navOverview?.classList.remove("active");
      navSettings?.classList.add("active");
      panelOverview?.classList.remove("active");
      panelSettings?.classList.add("active");
      if (heading) heading.textContent = "Admin Settings";
      if (subheading) subheading.textContent = "Manage demo data records, purge temporary users & configure platform parameters";
    } else {
      navSettings?.classList.remove("active");
      navOverview?.classList.add("active");
      panelSettings?.classList.remove("active");
      panelOverview?.classList.add("active");
      if (heading) heading.textContent = "Analytics Overview";
      if (subheading) subheading.textContent = "Platform telemetry, real-time dynamic analytics & registered user directory";
    }
  }

  navOverview?.addEventListener("click", function (e) {
    e.preventDefault();
    showTab("overview");
  });

  navSettings?.addEventListener("click", function (e) {
    e.preventDefault();
    showTab("settings");
  });
}

// ============================================================
// ADMIN LOGOUT
// ============================================================

function initializeAdminLogout() {
  function performLogout(e) {
    e?.preventDefault();
    sessionStorage.removeItem("expenseGuardAdminAuth");
    window.location.href = "admin-login.html";
  }

  const navLogout = document.getElementById("navLogout");
  const headerLogout = document.getElementById("adminHeaderLogoutBtn");

  navLogout?.addEventListener("click", performLogout);
  headerLogout?.addEventListener("click", performLogout);
}

// ============================================================
// USERS STORAGE HELPERS
// ============================================================

function getStoredUsers() {
  try {
    const raw = localStorage.getItem("expenseGuardUsers");
    const users = raw ? JSON.parse(raw) : [];
    return Array.isArray(users) ? users : [];
  } catch (err) {
    console.error("Error parsing expenseGuardUsers:", err);
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem("expenseGuardUsers", JSON.stringify(users));
}

// ============================================================
// DYNAMIC INSIGHTS CALCULATION
// ============================================================

function updateDynamicStatCards(userCount) {
  const count = Number(userCount) || 0;

  // Exact formulas specified:
  // Total Users: expenseGuardUsers.length
  // Total Page Views: expenseGuardUsers.length * 42
  // Active Sessions: Math.floor(expenseGuardUsers.length / 3)
  // Detected Anomalies: expenseGuardUsers.length * 2

  const totalUsers = count;
  const totalPageViews = count * 42;
  const activeSessions = Math.floor(count / 3);
  const detectedAnomalies = count * 2;

  const statTotalUsers = document.getElementById("statTotalUsers");
  const statPageViews = document.getElementById("statPageViews");
  const statActiveSessions = document.getElementById("statActiveSessions");
  const statDetectedAnomalies = document.getElementById("statDetectedAnomalies");
  const userCountBadge = document.getElementById("userCountBadge");

  if (statTotalUsers) {
    statTotalUsers.textContent = totalUsers.toLocaleString("en-IN");
    statTotalUsers.classList.add("loaded");
  }

  if (statPageViews) {
    statPageViews.textContent = totalPageViews.toLocaleString("en-IN");
    statPageViews.classList.add("loaded");
  }

  if (statActiveSessions) {
    statActiveSessions.textContent = activeSessions.toLocaleString("en-IN");
    statActiveSessions.classList.add("loaded");
  }

  if (statDetectedAnomalies) {
    statDetectedAnomalies.textContent = detectedAnomalies.toLocaleString("en-IN");
    statDetectedAnomalies.classList.add("loaded");
  }

  if (userCountBadge) {
    userCountBadge.textContent = `${count} ${count === 1 ? "User" : "Users"}`;
  }
}

// ============================================================
// REGISTERED USERS DIRECTORY TABLE
// ============================================================

function renderRegisteredUsersTable(users) {
  const tableBody = document.getElementById("adminUsersTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!users || users.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="3" class="table-empty-state">
          No users found.
        </td>
      </tr>
    `;
    return;
  }

  users.forEach((user, index) => {
    const row = document.createElement("tr");

    const name = (user.name || "Anonymous User").trim();
    const email = (user.email || "—").trim();
    const initials = getUserInitials(name);

    let createdDate = "Aug 2026";
    if (user.createdAt) {
      createdDate = formatAdminDate(user.createdAt);
    } else if (user.date) {
      createdDate = formatAdminDate(user.date);
    } else {
      const fallbackDaysAgo = Math.max(1, (index + 1) * 3);
      const d = new Date();
      d.setDate(d.getDate() - fallbackDaysAgo);
      createdDate = formatAdminDate(d.toISOString().slice(0, 10));
    }

    const demoBadge = user.isDemo
      ? `<span class="demo-user-tag">DEMO</span>`
      : "";

    row.innerHTML = `
      <td>
        <div class="user-name-cell">
          <div class="user-avatar-badge">${escapeHTML(initials)}</div>
          <div class="user-name-group">
            <span class="user-primary-name">${escapeHTML(name)}</span>
            ${demoBadge}
          </div>
        </div>
      </td>
      <td>
        <span class="user-email-text">${escapeHTML(email)}</span>
      </td>
      <td>
        <span class="user-date-pill">📅 ${escapeHTML(createdDate)}</span>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function refreshAdminDashboard() {
  const users = getStoredUsers();
  updateDynamicStatCards(users.length);
  renderRegisteredUsersTable(users);
}

// ============================================================
// DYNAMIC DEMO DATA INJECTION
// ============================================================

function initializeDemoAnalytics() {
  const loadBtn = document.getElementById("loadDemoAnalytics");
  if (!loadBtn) return;

  loadBtn.addEventListener("click", function () {
    const existingUsers = getStoredUsers();

    // Remove any previously injected fake users to prevent duplication
    const realUsers = existingUsers.filter((u) => !u.isDemo);

    // Inject 15 realistic fake user objects alongside real users
    const updatedUsers = [...realUsers, ...FAKE_DEMO_USERS];

    // Save to localStorage under expenseGuardUsers
    saveStoredUsers(updatedUsers);

    // Refresh dynamic stats and table immediately
    updateDynamicStatCards(updatedUsers.length);
    renderRegisteredUsersTable(updatedUsers);

    // Success alert
    alert("Demo analytics loaded successfully!");
  });
}

// ============================================================
// CLEAR DEMO DATA & USERS
// ============================================================

function initializeClearDemoData() {
  const clearBtn = document.getElementById("clearDemoDataBtn");
  if (!clearBtn) return;

  clearBtn.addEventListener("click", function () {
    const existingUsers = getStoredUsers();

    // Filter out fake demo users, preserving real user accounts
    const preservedUsers = existingUsers.filter((u) => !u.isDemo);

    // Save updated array to localStorage
    saveStoredUsers(preservedUsers);

    // Refresh dynamic stats and table
    updateDynamicStatCards(preservedUsers.length);
    renderRegisteredUsersTable(preservedUsers);

    // Success alert
    alert("Demo data successfully cleared.");
  });
}

// ============================================================
// HELPER UTILITIES
// ============================================================

function getUserInitials(name) {
  if (!name || name === "My Account") return "EG";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

function formatAdminDate(dateString) {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString.includes("T") ? dateString : dateString + "T00:00:00");
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return dateString;
  }
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
