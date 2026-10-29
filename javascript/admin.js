// ============================================================
// EXPENSEGUARD — STANDALONE ADMIN DASHBOARD (javascript/admin.js)
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
  checkAdminSession();
  initializeThemeToggle();
  initializeLogout();
  refreshDashboard();
  initializeLoadDemoData();
  initializeClearDemoData();
});

// ============================================================
// ADMIN SESSION AUTHENTICATION
// ============================================================

function checkAdminSession() {
  const isAuth = sessionStorage.getItem("expenseGuardAdminAuth");
  if (isAuth !== "true") {
    const password = prompt("Enter Admin Password:");
    if (password && password.trim() === "admin123") {
      sessionStorage.setItem("expenseGuardAdminAuth", "true");
    } else {
      alert("Access Denied.");
      window.location.href = "signin.html";
    }
  }
}

// ============================================================
// THEME TOGGLE (DARK NAVY / LIGHT)
// ============================================================

function initializeThemeToggle() {
  const btn = document.getElementById("adminThemeToggle");
  const icon = document.getElementById("themeIcon");
  const text = document.getElementById("themeText");

  function updateVisuals(theme) {
    const isLight = theme === "light";
    if (icon) icon.textContent = isLight ? "☀️" : "🌙";
    if (text) text.textContent = isLight ? "Light" : "Navy";
  }

  const currentTheme = localStorage.getItem("expenseGuardTheme") || "navy";
  updateVisuals(currentTheme);

  if (btn) {
    btn.addEventListener("click", function () {
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
      updateVisuals(newTheme);
    });
  }
}

// ============================================================
// LOGOUT
// ============================================================

function initializeLogout() {
  const btn = document.getElementById("adminLogoutBtn");
  if (btn) {
    btn.addEventListener("click", function () {
      sessionStorage.removeItem("expenseGuardAdminAuth");
    });
  }
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
    console.error("Error reading expenseGuardUsers:", err);
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem("expenseGuardUsers", JSON.stringify(users));
}

// ============================================================
// DYNAMIC METRICS CALCULATION
// ============================================================

function updateMetrics(userCount) {
  const count = Number(userCount) || 0;

  const totalUsers = count;
  const totalPageViews = count * 42;
  const activeSessions = Math.floor(count / 3);
  const detectedAnomalies = count * 2;

  const statTotalUsers = document.getElementById("statTotalUsers");
  const statPageViews = document.getElementById("statPageViews");
  const statActiveSessions = document.getElementById("statActiveSessions");
  const statDetectedAnomalies = document.getElementById("statDetectedAnomalies");
  const userCountBadge = document.getElementById("userCountBadge");

  if (statTotalUsers) statTotalUsers.textContent = totalUsers.toLocaleString("en-IN");
  if (statPageViews) statPageViews.textContent = totalPageViews.toLocaleString("en-IN");
  if (statActiveSessions) statActiveSessions.textContent = activeSessions.toLocaleString("en-IN");
  if (statDetectedAnomalies) statDetectedAnomalies.textContent = detectedAnomalies.toLocaleString("en-IN");
  if (userCountBadge) userCountBadge.textContent = `${count} ${count === 1 ? "User" : "Users"}`;
}

// ============================================================
// RENDER REGISTERED USERS TABLE
// ============================================================

function renderUsersTable(users) {
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

function refreshDashboard() {
  const users = getStoredUsers();
  updateMetrics(users.length);
  renderUsersTable(users);
}

// ============================================================
// LOAD DEMO DATA
// ============================================================

function initializeLoadDemoData() {
  const btn = document.getElementById("loadDemoDataBtn");
  if (!btn) return;

  btn.addEventListener("click", function () {
    const existing = getStoredUsers();
    const realUsers = existing.filter((u) => !u.isDemo);
    const updatedUsers = [...realUsers, ...FAKE_DEMO_USERS];

    saveStoredUsers(updatedUsers);
    refreshDashboard();
    alert("Demo data loaded successfully!");
  });
}

// ============================================================
// CLEAR DEMO DATA
// ============================================================

function initializeClearDemoData() {
  const btn = document.getElementById("clearDemoDataBtn");
  if (!btn) return;

  btn.addEventListener("click", function () {
    const existing = getStoredUsers();
    const preserved = existing.filter((u) => !u.isDemo);

    saveStoredUsers(preserved);
    refreshDashboard();
    alert("Demo data cleared.");
  });
}

// ============================================================
// UTILITIES
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
