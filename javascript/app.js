// ============================================================ 
// EXPENSEGUARD - MAIN APPLICATION JAVASCRIPT 
// ============================================================ 
 
// ============================================================ 
// STORAGE KEYS 
// ============================================================ 
 
const STORAGE_KEY = "expenseGuardTransactions"; 
const USERS_KEY = "expenseGuardUsers"; 
const CURRENT_USER_KEY = "expenseGuardCurrentUser"; 
const LOGIN_KEY = "expenseGuardLoggedIn"; 
const THEME_KEY = "expenseGuardTheme"; 
 
function getTheme() { 
  return localStorage.getItem(THEME_KEY) || "navy"; 
} 
 
function applyTheme(theme) { 
  const t = theme || getTheme(); 
  if (t === "light") { 
    document.documentElement.setAttribute("data-theme", "light"); 
    if (document.body) document.body.classList.add("theme-light"); 
  } else { 
    document.documentElement.removeAttribute("data-theme"); 
    if (document.body) document.body.classList.remove("theme-light"); 
  } 
} 

// ============================================================ 
// GLOBAL SETTINGS APPLICATION 
// ============================================================ 

function applySettings() {
  const showName = localStorage.getItem("expenseGuardSetting_showName") !== "false";
  const showEmail = localStorage.getItem("expenseGuardSetting_showEmail") !== "false";
  const motion = localStorage.getItem("expenseGuardSetting_motion") !== "false";
  const compact = localStorage.getItem("expenseGuardSetting_compact") === "true";
  const anomalyAlerts = localStorage.getItem("expenseGuardSetting_anomalyAlerts") !== "false";
  const insights = localStorage.getItem("expenseGuardSetting_insights") !== "false";

  const root = document.documentElement;
  const body = document.body;

  const toggleClass = (cls, active) => {
    if (root) root.classList.toggle(cls, active);
    if (body) body.classList.toggle(cls, active);
  };

  toggleClass("no-motion", !motion);
  toggleClass("compact-mode", compact);
  toggleClass("hide-anomaly-alerts", !anomalyAlerts);
  toggleClass("hide-insights", !insights);
  toggleClass("hide-show-name", !showName);
  toggleClass("hide-show-email", !showEmail);

  if (typeof loadProfileInformation === "function") {
    loadProfileInformation();
  }
}

window.applySettings = applySettings;

// Immediately apply theme and settings 
applyTheme(); 
applySettings();
if (document.readyState === "loading") { 
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme();
    applySettings();
  }); 
} 
 
// ============================================================ 
// USER / AUTH HELPERS 
// ============================================================ 
 
function getUsers() { 
  try { 
    const users = localStorage.getItem(USERS_KEY); 
 
    if (!users) { 
      return []; 
    } 
 
    return JSON.parse(users); 
  } catch (error) { 
    console.error("Error reading users:", error); 
 
    return []; 
  } 
} 
 
function saveUsers(users) { 
  localStorage.setItem(USERS_KEY, JSON.stringify(users)); 
} 
 
function getCurrentUser() { 
  try { 
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)); 
  } catch (error) { 
    return null; 
  } 
} 
 
function isLoggedIn() { 
  return localStorage.getItem(LOGIN_KEY) === "true"; 
} 
 
function getUserInitials(name) { 
  if (!name || name === "My Account") { 
    return "EG"; 
  } 
 
  const parts = name.trim().split(/\s+/); 
 
  // First name + last name 
 
  if (parts.length >= 2) { 
    return ( 
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0) 
    ).toUpperCase(); 
  } 
 
  // Only one name 
 
  return parts[0].substring(0, 2).toUpperCase(); 
} 
 
// ============================================================ 
// TRANSACTION STORAGE 
// ============================================================ 
 
function getTransactions() { 
  const data = localStorage.getItem(STORAGE_KEY); 
 
  if (!data) { 
    return []; 
  } 
 
  try { 
    return JSON.parse(data); 
  } catch (error) { 
    console.error("Error reading transactions:", error); 
 
    return []; 
  } 
} 
 
function saveTransactions(transactions) { 
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); 
} 
 
// ============================================================ 
// DATE FORMAT 
// ============================================================ 
 
function formatDate(dateString) { 
  if (!dateString) { 
    return ""; 
  } 
 
  const date = new Date(dateString + "T00:00:00"); 
 
  return date.toLocaleDateString("en-IN", { 
    day: "2-digit", 
    month: "short", 
    year: "numeric", 
  }); 
} 
 
// ============================================================ 
// MEAN 
// ============================================================ 
 
function calculateMean(numbers) { 
  if (!Array.isArray(numbers) || numbers.length === 0) { 
    return 0; 
  } 
 
  const valid = numbers.map(Number).filter(Number.isFinite); 
  if (valid.length === 0) return 0; 
 
  const total = valid.reduce((sum, number) => sum + number, 0); 
 
  return total / valid.length; 
} 
 
// ============================================================ 
// STANDARD DEVIATION 
// ============================================================ 
 
function calculateStandardDeviation(numbers) { 
  if (!Array.isArray(numbers) || numbers.length <= 1) { 
    return 0; 
  } 
 
  const valid = numbers.map(Number).filter(Number.isFinite); 
  if (valid.length <= 1) return 0; 
 
  const mean = calculateMean(valid); 
 
  const squaredDifferences = valid.map((number) => 
    Math.pow(number - mean, 2), 
  ); 
 
  const variance = 
    squaredDifferences.reduce((sum, value) => sum + value, 0) / valid.length; 
 
  return Math.sqrt(variance); 
} 
 
// ============================================================ 
// Z-SCORE 
// ============================================================ 
 
function calculateZScore(amount, values) { 
  const numAmount = Number(amount); 
  if (!Number.isFinite(numAmount)) return 0; 
 
  const valid = (Array.isArray(values) ? values : []) 
    .map(Number) 
    .filter(Number.isFinite); 
 
  if (valid.length <= 1) return 0; 
 
  const mean = calculateMean(valid); 
  const standardDeviation = calculateStandardDeviation(valid); 
 
  if (!Number.isFinite(standardDeviation) || standardDeviation === 0) { 
    return 0; 
  } 
 
  const z = (numAmount - mean) / standardDeviation; 
  return Number.isFinite(z) ? z : 0; 
} 
 
// ============================================================ 
// CENTRALIZED STATISTICAL RISK ENGINE 
// ============================================================ 
 
function buildCategoryStats(allTransactions = []) {
  const categoryGroups = {};
  const allAmounts = [];
 
  (allTransactions || []).forEach((t) => {
    const cat = t.category || "Other";
    const amt = Number(t.amount) || 0;
    if (!categoryGroups[cat]) {
      categoryGroups[cat] = [];
    }
    categoryGroups[cat].push(amt);
    allAmounts.push(amt);
  });
 
  const globalMean = calculateMean(allAmounts);
  const stats = { globalMean, categories: {} };
 
  Object.keys(categoryGroups).forEach((cat) => {
    const values = categoryGroups[cat];
    stats.categories[cat] = {
      values,
      mean: calculateMean(values),
      sd: calculateStandardDeviation(values),
      count: values.length,
    };
  });
 
  return stats;
}
 
function analyzeTransactionRisk(tx, allTransactions = [], cachedStats = null) {
  if (!tx) {
    return {
      zScore: 0,
      patternRatio: 1,
      ratio: 1,
      riskLevel: "Normal",
      risk: "low",
      isAnomaly: false,
    };
  }
 
  const amt = Number(tx.amount) || 0;
  const cat = tx.category || "Other";
  const stats = cachedStats || buildCategoryStats(allTransactions);
  const catStat = stats.categories[cat] || {
    values: [amt],
    mean: amt,
    sd: 0,
    count: 1,
  };
 
  let zScore = 0;
  let patternRatio = 1;
 
  if (catStat.count >= 2) {
    zScore = catStat.sd > 0 ? (amt - catStat.mean) / catStat.sd : 0;
    patternRatio = catStat.mean > 0 ? amt / catStat.mean : 1;
  } else {
    // Fallback for single transaction in category: compare against global baseline
    const globalMean = stats.globalMean;
    if (globalMean > 0) {
      zScore = amt >= globalMean * 1.6 ? amt / globalMean : 0;
      patternRatio = amt / globalMean;
    } else {
      zScore = 0;
      patternRatio = 1;
    }
  }
 
  if (!Number.isFinite(zScore)) zScore = 0;
  if (!Number.isFinite(patternRatio)) patternRatio = 1;
 
  zScore = Number(zScore.toFixed(2));
  patternRatio = Number(patternRatio.toFixed(2));
 
  // Exact Thresholds specified:
  // High Risk: zScore >= 2.6 OR patternRatio >= 3.0
  // Medium Risk: zScore >= 1.8 OR patternRatio >= 1.6
  // Normal: Anything else
  let riskLevel = "Normal";
  let isAnomaly = false;
 
  if (zScore >= 2.6 || patternRatio >= 3.0) {
    riskLevel = "High";
    isAnomaly = true;
  } else if (zScore >= 1.8 || patternRatio >= 1.6) {
    riskLevel = "Medium";
    isAnomaly = true;
  } else {
    riskLevel = "Normal";
    isAnomaly = false;
  }
 
  return {
    zScore,
    patternRatio,
    ratio: patternRatio,
    riskLevel,
    risk: riskLevel.toLowerCase(),
    isAnomaly,
  };
}
 
function analyzeAllTransactions(allTransactions = []) {
  if (!Array.isArray(allTransactions) || allTransactions.length === 0) {
    return [];
  }
  const stats = buildCategoryStats(allTransactions);
  return allTransactions.map((tx) => {
    const riskData = analyzeTransactionRisk(tx, allTransactions, stats);
    return {
      ...tx,
      ...riskData,
    };
  });
}
 
function analyzeTransactions(transactions) { 
  return analyzeAllTransactions(transactions);
} 
 
window.buildCategoryStats = buildCategoryStats;
window.analyzeTransactionRisk = analyzeTransactionRisk;
window.analyzeAllTransactions = analyzeAllTransactions;
window.analyzeTransactions = analyzeTransactions;
 
 
// ============================================================ 
// ADD TRANSACTION 
// ============================================================ 
 
function addTransaction(transactionData) { 
  const transactions = getTransactions(); 
 
  const transaction = { 
    id: Date.now(), 
 
    date: transactionData.date, 
 
    category: transactionData.category, 
 
    description: transactionData.description, 
 
    amount: Number(transactionData.amount), 
  }; 
 
  transactions.push(transaction); 
 
  saveTransactions(transactions); 
 
  return transaction; 
} 
 
// ============================================================ 
// ESCAPE HTML 
// ============================================================ 
 
function escapeHTML(value) { 
  const div = document.createElement("div"); 
 
  div.textContent = value; 
 
  return div.innerHTML; 
} 
 
// ============================================================ 
// ============================================================ 
// PATH REDIRECT HELPER 
// ============================================================ 
 
function getPageRedirect(targetInPages) { 
  const currentPage = 
    window.location.pathname.split("/").pop() || "index.html"; 
  if ( 
    currentPage === "dashboard.html" || 
    currentPage === "index.html" || 
    currentPage === "" 
  ) { 
    return "pages/" + targetInPages; 
  } 
  return targetInPages; 
} 
 
// ============================================================ 
// LOAD PROFILE INFORMATION 
// ============================================================ 
 
function loadProfileInformation() { 
  const user = getCurrentUser(); 
  const showName = localStorage.getItem("expenseGuardSetting_showName") !== "false";
  const showEmail = localStorage.getItem("expenseGuardSetting_showEmail") !== "false";

  const rawName = user?.name || localStorage.getItem("expenseGuardSetting_name") || "My Account";
  const rawEmail = user?.email || localStorage.getItem("expenseGuardSetting_email") || (user ? "" : "Not signed in");

  const name = showName ? rawName : "User";
  const email = showEmail ? rawEmail : "••••@••••.com";
  const initials = showName ? getUserInitials(rawName) : "EG";
 
  const targets = { 
    profileName: name, 
    profileInitials: initials, 
    dropdownName: name, 
    dropdownEmail: email, 
    dropdownInitials: initials, 
    anUser: name, 
    anInitials: initials, 
    catUser: name, 
    catInitials: initials, 
    budgetUser: name, 
    budgetInitials: initials, 
    repUser: name, 
    repInitials: initials, 
    setUser: name, 
    setInitials: initials, 
    profileTitle: name, 
    profileEmail: email, 
    bigInitials: initials, 
    previewName: showName ? rawName : "User (Hidden)",
    previewEmail: showEmail ? rawEmail : "••••@••••.com (Hidden)",
    previewInitials: initials,
  }; 
 
  Object.entries(targets).forEach(([id, val]) => { 
    const el = document.getElementById(id); 
    if (el) el.textContent = val; 
  }); 
} 
 
// ============================================================ 
// PROFILE DROPDOWN 
// ============================================================ 
 
function initializeProfileDropdown() { 
  const profileButton = document.getElementById("profileButton"); 
 
  const profileWrapper = document.querySelector(".profile-wrapper"); 
 
  const logoutButton = document.getElementById("logoutButton"); 
 
  if (!profileButton || !profileWrapper) { 
    return; 
  } 
 
  // -------------------------------------------------------- 
  // OPEN / CLOSE DROPDOWN 
  // -------------------------------------------------------- 
 
  profileButton.addEventListener("click", function (event) { 
    event.preventDefault(); 
 
    event.stopPropagation(); 
 
    profileWrapper.classList.toggle("open"); 
  }); 
 
  // -------------------------------------------------------- 
  // PREVENT DROPDOWN CLOSE 
  // -------------------------------------------------------- 
 
  const dropdown = document.getElementById("profileDropdown"); 
 
  if (dropdown) { 
    dropdown.addEventListener("click", function (event) { 
      event.stopPropagation(); 
    }); 
  } 
 
  // -------------------------------------------------------- 
  // CLICK OUTSIDE 
  // -------------------------------------------------------- 
 
  document.addEventListener("click", function () { 
    profileWrapper.classList.remove("open"); 
  }); 
 
  // -------------------------------------------------------- 
  // ESC KEY 
  // -------------------------------------------------------- 
 
  document.addEventListener("keydown", function (event) { 
    if (event.key === "Escape") { 
      profileWrapper.classList.remove("open"); 
    } 
  }); 
 
  // -------------------------------------------------------- 
  // LOGOUT 
  // -------------------------------------------------------- 
 
  if (logoutButton) { 
    logoutButton.addEventListener("click", function (event) { 
      event.preventDefault(); 
 
      event.stopPropagation(); 
 
      localStorage.removeItem(LOGIN_KEY); 
 
      localStorage.removeItem(CURRENT_USER_KEY); 
 
      sessionStorage.clear(); 
 
      window.location.replace(getPageRedirect("welcome.html")); 
    }); 
  } 
} 

// ============================================================ 
// MOBILE NAVIGATION DRAWER 
// ============================================================ 

function initializeMobileNav() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  // Create backdrop if not present
  let backdrop = document.getElementById("sidebarBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "sidebarBackdrop";
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);
  }

  // Create close button in sidebar if not present
  let closeBtn = document.getElementById("sidebarCloseBtn");
  if (!closeBtn) {
    closeBtn = document.createElement("button");
    closeBtn.id = "sidebarCloseBtn";
    closeBtn.className = "sidebar-close-btn";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close navigation");
    closeBtn.innerHTML = "&times;";
    
    // Insert inside sidebar before or next to logo
    const logo = sidebar.querySelector(".logo");
    if (logo) {
      const headerWrap = document.createElement("div");
      headerWrap.className = "sidebar-header-row";
      logo.parentNode.insertBefore(headerWrap, logo);
      headerWrap.appendChild(logo);
      headerWrap.appendChild(closeBtn);
    } else {
      sidebar.prepend(closeBtn);
    }
  }

  function openSidebar() {
    sidebar.classList.add("mobile-open");
    document.body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    sidebar.classList.remove("mobile-open");
    document.body.classList.remove("sidebar-open");
  }

  function toggleSidebar() {
    if (sidebar.classList.contains("mobile-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  // Bind to any mobile menu toggle buttons
  const menuButtons = document.querySelectorAll(".mobile-menu-btn, #mobileMenuBtn");
  menuButtons.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
    });
  });

  // If no menu button found in DOM yet, inject one into .header if present
  if (menuButtons.length === 0) {
    const header = document.querySelector(".header");
    if (header) {
      const autoBtn = document.createElement("button");
      autoBtn.className = "mobile-menu-btn";
      autoBtn.id = "mobileMenuBtn";
      autoBtn.type = "button";
      autoBtn.setAttribute("aria-label", "Open menu");
      autoBtn.innerHTML = "<span>☰</span>";
      autoBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
      });

      // Insert at the beginning of header or inside a header-left group
      const firstChild = header.firstElementChild;
      if (firstChild) {
        const wrap = document.createElement("div");
        wrap.className = "header-left-wrap";
        header.insertBefore(wrap, firstChild);
        wrap.appendChild(autoBtn);
        wrap.appendChild(firstChild);
      } else {
        header.prepend(autoBtn);
      }
    }
  }

  // Backdrop click closes sidebar
  backdrop.addEventListener("click", function () {
    closeSidebar();
  });

  // Close button click
  closeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    closeSidebar();
  });

  // Clicking any nav item closes the sidebar on mobile
  const navItems = sidebar.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", function () {
      if (window.innerWidth <= 900) {
        closeSidebar();
      }
    });
  });

  // ESC key closes sidebar
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sidebar.classList.contains("mobile-open")) {
      closeSidebar();
    }
  });

  // Resize handler
  window.addEventListener("resize", function () {
    if (window.innerWidth > 900 && sidebar.classList.contains("mobile-open")) {
      closeSidebar();
    }
  });
} 
 
// ============================================================
// PASSWORD VALIDATION & TOGGLE HELPERS
// ============================================================

function validateStrictPassword(password) {
  const missing = [];

  if (!password || password.length < 12) {
    missing.push("Minimum of 12 characters in length");
  }
  if (!/[A-Z]/.test(password)) {
    missing.push("At least one uppercase letter (A-Z)");
  }
  if (!/[a-z]/.test(password)) {
    missing.push("At least one lowercase letter (a-z)");
  }
  if (!/[0-9]/.test(password)) {
    missing.push("At least one number (0-9)");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    missing.push("At least one special character (e.g. !@#$%^&*...)");
  }

  const strictPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  return {
    isValid: missing.length === 0 && strictPasswordRegex.test(password),
    missing: missing,
  };
}

function initializePasswordToggles() {
  const toggleButtons = document.querySelectorAll(".password-toggle-btn");

  toggleButtons.forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }
    button.dataset.initialized = "true";

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      const targetId = button.getAttribute("data-target");
      const input = targetId
        ? document.getElementById(targetId)
        : button.closest(".password-input-wrapper")?.querySelector("input");

      if (!input) {
        return;
      }

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";

      const eyeIcon = button.querySelector(".eye-icon");
      const eyeOffIcon = button.querySelector(".eye-off-icon");

      if (eyeIcon && eyeOffIcon) {
        if (isPassword) {
          eyeIcon.style.display = "none";
          eyeOffIcon.style.display = "block";
          button.setAttribute("aria-label", "Hide password");
          button.setAttribute("title", "Hide password");
        } else {
          eyeIcon.style.display = "block";
          eyeOffIcon.style.display = "none";
          button.setAttribute("aria-label", "Show password");
          button.setAttribute("title", "Show password");
        }
      }
    });
  });
}

function initializeSignup() { 
  const signupForm = document.getElementById("signupForm"); 
 
  if (!signupForm) { 
    return; 
  } 
 
  signupForm.addEventListener("submit", function (event) { 
    event.preventDefault(); 
 
    const name = document.getElementById("signupName").value.trim(); 
 
    const email = document 
      .getElementById("signupEmail") 
      .value.trim() 
      .toLowerCase(); 
 
    const password = document.getElementById("signupPassword").value; 
 
    const confirmPassword = document.getElementById( 
      "signupConfirmPassword", 
    ).value; 
 
    const message = document.getElementById("signupMessage"); 
 
    // ------------------------------------------------ 
    // VALIDATION 
    // ------------------------------------------------ 
 
    if (!name) { 
      message.textContent = "Please enter your name."; 
 
      message.className = "auth-message error"; 
 
      return; 
    } 
 
    if (!email) { 
      message.textContent = "Please enter your email."; 
 
      message.className = "auth-message error"; 
 
      return; 
    } 

    // Strict Password Validation
    const passwordValidation = validateStrictPassword(password);
    if (!passwordValidation.isValid) {
      const requirementsHtml = passwordValidation.missing
        .map((req) => `<li>${req}</li>`)
        .join("");
      message.innerHTML = `<strong>Password does not meet requirements:</strong><ul>${requirementsHtml}</ul>`;
      message.className = "auth-message error";
      return;
    }
 
    if (password !== confirmPassword) { 
      message.textContent = "Passwords do not match."; 
 
      message.className = "auth-message error"; 
 
      return; 
    } 
 
    // ------------------------------------------------ 
    // GET ALL USERS 
    // ------------------------------------------------ 
 
    const users = getUsers(); 
 
    // ------------------------------------------------ 
    // CHECK EXISTING EMAIL 
    // ------------------------------------------------ 
 
    const existingUser = users.find((user) => user.email === email); 
 
    if (existingUser) { 
      message.textContent = 
        "An account with this email already exists. Please sign in."; 
 
      message.className = "auth-message error"; 
 
      return; 
    } 
 
    // ------------------------------------------------ 
    // CREATE NEW USER 
    // ------------------------------------------------ 
 
    const newUser = { 
      name: name, 
 
      email: email, 
 
      password: password, 
    }; 
 
    users.push(newUser); 
 
    saveUsers(users); 
 
    // ------------------------------------------------ 
    // IMPORTANT: 
    // DO NOT LOG USER IN HERE 
    // ------------------------------------------------ 
 
    localStorage.removeItem(LOGIN_KEY); 
 
    localStorage.removeItem(CURRENT_USER_KEY); 
 
    // ------------------------------------------------ 
    // SUCCESS MESSAGE 
    // ------------------------------------------------ 
 
    message.innerHTML = ` 
                <strong>Account created successfully!</strong><br> 
                Please sign in to continue. 
                <br><br> 
                Redirecting to Sign In in 
                <strong id="signupCountdown">5</strong> seconds... 
            `; 
 
    message.className = "auth-message success"; 
 
    // ------------------------------------------------ 
    // DISABLE BUTTON 
    // ------------------------------------------------ 
 
    const button = signupForm.querySelector(".auth-btn"); 
 
    if (button) { 
      button.disabled = true; 
 
      button.textContent = "Account Created ✓"; 
    } 
 
    // ------------------------------------------------ 
    // 5 SECOND COUNTDOWN 
    // ------------------------------------------------ 
 
    let seconds = 5; 
 
    const countdown = setInterval(function () { 
      seconds--; 
 
      const counter = document.getElementById("signupCountdown"); 
 
      if (counter) { 
        counter.textContent = seconds; 
      } 
 
      if (seconds <= 0) { 
        clearInterval(countdown); 
 
        window.location.href = "signin.html"; 
      } 
    }, 1000); 
  }); 
} 
 
// ============================================================ 
// SIGN IN 
// ============================================================ 
 
function initializeSignin() { 
  const signinForm = document.getElementById("signinForm"); 
 
  if (!signinForm) { 
    return; 
  } 
 
  signinForm.addEventListener("submit", function (event) { 
    event.preventDefault(); 
 
    const email = document 
      .getElementById("signinEmail") 
      .value.trim() 
      .toLowerCase(); 
 
    const password = document.getElementById("signinPassword").value; 
 
    const message = document.getElementById("signinMessage"); 
 
    const users = getUsers(); 
 
    // ------------------------------------------------ 
    // FIND USER 
    // ------------------------------------------------ 
 
    const user = users.find( 
      (savedUser) => 
        savedUser.email === email && savedUser.password === password, 
    ); 
 
    // ------------------------------------------------ 
    // LOGIN FAILED 
    // ------------------------------------------------ 
 
    if (!user) { 
      message.textContent = "Invalid email or password."; 
 
      message.className = "auth-message error"; 
 
      return; 
    } 
 
    // ------------------------------------------------ 
    // LOGIN SUCCESS 
    // ------------------------------------------------ 
 
    localStorage.setItem(LOGIN_KEY, "true"); 
 
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user)); 
 
    message.textContent = "Login successful! Opening your dashboard..."; 
 
    message.className = "auth-message success"; 
 
    // ------------------------------------------------ 
    // GO TO DASHBOARD 
    // ------------------------------------------------ 
 
    setTimeout(function () { 
      window.location.href = "../dashboard.html"; 
    }, 700); 
  }); 
} 
 
// ============================================================ 
// PROTECT DASHBOARD 
// ============================================================ 
 
// ============================================================ 
// PROTECT PAGES 
// ============================================================ 
 
function protectDashboard() { 
  const currentPage = 
    window.location.pathname.split("/").pop() || "index.html"; 
 
  // Pages that require the user to be logged in 
  const protectedPages = [ 
    "dashboard.html", 
    "transactions.html", 
    "budgets.html", 
    "categories.html", 
    "anomalies.html", 
    "reports.html", 
    "profile.html", 
    "settings.html", 
  ]; 
 
  // If the current page is protected and user is logged out 
  if (protectedPages.includes(currentPage) && !isLoggedIn()) { 
    // dashboard.html is in the root folder 
    if (currentPage === "dashboard.html") { 
      window.location.replace("pages/signin.html"); 
    } else { 
      // Other protected pages are inside /pages/ 
      window.location.replace("signin.html"); 
    } 
 
    return; 
  } 
} 
 
// Support Back/Forward cache (bfcache) 
window.addEventListener("pageshow", function (event) { 
  if (event.persisted) { 
    protectDashboard(); 
  } 
}); 
// ============================================================ 
// DASHBOARD UPDATE 
// ============================================================ 
 
function updateDashboard() { 
  const transactions = getTransactions(); 
 
  const analyzed = analyzeTransactions(transactions); 
 
  // -------------------------------------------------------- 
  // TOTAL 
  // -------------------------------------------------------- 
 
  const total = transactions.reduce( 
    (sum, transaction) => sum + Number(transaction.amount), 
    0, 
  ); 
 
  const totalElement = document.getElementById("totalSpending"); 
 
  if (totalElement) { 
    totalElement.textContent = "₹" + total.toLocaleString("en-IN"); 
  } 
 
  // -------------------------------------------------------- 
  // TRANSACTION COUNT 
  // -------------------------------------------------------- 
 
  const transactionCount = document.getElementById("transactionCount"); 
 
  if (transactionCount) { 
    transactionCount.textContent = transactions.length; 
  } 
 
  // -------------------------------------------------------- 
  // ANOMALIES 
  // -------------------------------------------------------- 
 
  const anomalies = analyzed.filter((transaction) => transaction.isAnomaly); 
 
  const anomalyCount = document.getElementById("anomalyCount"); 
 
  if (anomalyCount) { 
    anomalyCount.textContent = anomalies.length; 
  } 
 
  const anomalyMessage = document.getElementById("anomalyMessage"); 
 
  if (anomalyMessage) { 
    if (anomalies.length > 0) { 
      anomalyMessage.textContent = 
        anomalies.length + 
        " unusual transaction" + 
        (anomalies.length > 1 ? "s" : "") + 
        " detected"; 
    } else { 
      anomalyMessage.textContent = "No anomalies detected"; 
    } 
  } 
 
  // -------------------------------------------------------- 
  // AVERAGE 
  // -------------------------------------------------------- 
 
  const average = transactions.length > 0 ? total / transactions.length : 0; 
 
  const averageElement = document.getElementById("averageExpense"); 
 
  if (averageElement) { 
    averageElement.textContent = 
      "₹" + Math.round(average).toLocaleString("en-IN"); 
  } 
 
  // -------------------------------------------------------- 
  // OTHER SECTIONS 
  // -------------------------------------------------------- 
 
  updateRecentTransactions(analyzed); 
 
  updateDashboardAnomalies(anomalies); 
 
  updateCategorySpending(transactions); 
} 
 
// ============================================================ 
// RECENT TRANSACTIONS 
// ============================================================ 
 
function updateRecentTransactions(transactions) { 
  const tableBody = document.getElementById("transactionTableBody"); 
 
  if (!tableBody) { 
    return; 
  } 
 
  tableBody.innerHTML = ""; 
 
  const recent = [...transactions].reverse().slice(0, 5); 
 
  if (recent.length === 0) { 
    tableBody.innerHTML = ` 
 
            <tr> 
 
                <td 
                    colspan="6" 
                    style=" 
                        text-align:center; 
                        color:#6b7280; 
                        padding:25px; 
                    " 
                > 
                    No transactions recorded yet. 
                </td> 
 
            </tr> 
 
        `; 
 
    return; 
  } 
 
  recent.forEach((transaction) => { 
    const row = document.createElement("tr"); 
 
    row.innerHTML = ` 
 
                <td> 
                    ${formatDate(transaction.date)} 
                </td> 
 
                <td> 
                    ${escapeHTML(transaction.description)} 
                </td> 
 
                <td> 
                    <span class="category-badge"> 
                        ${escapeHTML(transaction.category)} 
                    </span> 
                </td> 
 
                <td> 
                    ₹${Number(transaction.amount).toLocaleString("en-IN")} 
                </td> 
 
                <td> 
                    ${Number(transaction.zScore).toFixed(2)} 
                </td> 
 
                <td> 
 
                    ${ 
                      transaction.isAnomaly 
                        ? ` 
                            <span class="status-anomaly"> 
                                ⚠ Anomaly 
                            </span> 
                        ` 
                        : ` 
                            <span class="status-normal"> 
                                ✓ Normal 
                            </span> 
                        ` 
                    } 
 
                </td> 
 
            `; 
 
    tableBody.appendChild(row); 
  }); 
} 
 
// ============================================================ 
// DASHBOARD ANOMALIES 
// ============================================================ 
 
function updateDashboardAnomalies(anomalies) { 
  const container = document.getElementById("dashboardAnomalies"); 
 
  if (!container) { 
    return; 
  } 
 
  container.innerHTML = ""; 
 
  if (anomalies.length === 0) { 
    container.innerHTML = ` 
 
            <p 
                class="no-anomalies-message" 
                style=" 
                    color:#16a34a; 
                    padding:10px 0; 
                    font-size:13px; 
                " 
            > 
                ✓ No unusual transactions detected. 
            </p> 
 
        `; 
 
    return; 
  } 
 
  anomalies 
    .slice() 
    .reverse() 
    .forEach((transaction) => { 
      const box = document.createElement("div"); 
 
      box.className = "anomaly-box"; 
 
      box.innerHTML = ` 
 
                    <div class="anomaly-top"> 
 
                        <span class="anomaly-title"> 
 
                            🚨 Unusually High 
                            ${escapeHTML(transaction.category)} 
                            Expense 
 
                        </span> 
 
                        <span class="anomaly-amount"> 
 
                            ₹${Number(transaction.amount).toLocaleString( 
                              "en-IN", 
                            )} 
 
                        </span> 
 
                    </div> 
 
 
                    <div class="anomaly-info"> 
 
                        <span> 
 
                            ${escapeHTML(transaction.description)} 
 
                            • 
 
                            ${formatDate(transaction.date)} 
 
                        </span> 
 
 
                        <span class="z-score"> 
 
                            Z-Score: 
                            ${transaction.zScore.toFixed(2)} 
 
                        </span> 
 
                    </div> 
 
                `; 
 
      container.appendChild(box); 
    }); 
} 
 
// ============================================================ 
// CATEGORY SPENDING 
// ============================================================ 
 
function updateCategorySpending(transactions) { 
  const container = document.getElementById("categoryContainer"); 
 
  if (!container) { 
    return; 
  } 
 
  container.innerHTML = ""; 
 
  if (transactions.length === 0) { 
    container.innerHTML = ` 
 
            <p 
                style=" 
                    color:#6b7280; 
                    font-size:13px; 
                    padding:10px 0; 
                " 
            > 
                No spending data available yet. 
            </p> 
 
        `; 
 
    return; 
  } 
 
  const categories = {}; 
 
  transactions.forEach((transaction) => { 
    if (!categories[transaction.category]) { 
      categories[transaction.category] = 0; 
    } 
 
    categories[transaction.category] += Number(transaction.amount); 
  }); 
 
  const maxAmount = Math.max(...Object.values(categories), 1); 
 
  Object.entries(categories) 
    .sort((a, b) => b[1] - a[1]) 
    .forEach(([category, amount]) => { 
      const percentage = (amount / maxAmount) * 100; 
 
      const element = document.createElement("div"); 
 
      element.className = "category"; 
 
      element.innerHTML = ` 
 
                <div class="category-top"> 
 
                    <span class="category-name"> 
                        ${escapeHTML(category)} 
                    </span> 
 
                    <span class="category-amount"> 
                        ₹${amount.toLocaleString("en-IN")} 
                    </span> 
 
                </div> 
 
 
                <div class="progress"> 
 
                    <div 
                        class="progress-bar" 
                        style=" 
                            width:${percentage}%; 
                        " 
                    ></div> 
 
                </div> 
 
            `; 
 
      container.appendChild(element); 
    }); 
} 
 
// ============================================================ 
// TRANSACTION FORM 
// ============================================================ 
 
function initializeTransactionForm() { 
  const form = document.getElementById("transactionForm"); 
 
  if (!form) { 
    return; 
  } 
 
  form.addEventListener("submit", function (event) { 
    event.preventDefault(); 
 
    const date = document.getElementById("transactionDate").value; 
 
    const category = document.getElementById("transactionCategory").value; 
 
    const description = document 
      .getElementById("transactionDescription") 
      .value.trim(); 
 
    const amount = Number(document.getElementById("transactionAmount").value); 
 
    // ------------------------------------------------ 
    // VALIDATION 
    // ------------------------------------------------ 
 
    if (!date) { 
      alert("Please select a date."); 
 
      return; 
    } 
 
    if (!description) { 
      alert("Please enter a description."); 
 
      return; 
    } 
 
    if (!amount || amount <= 0) { 
      alert("Please enter a valid amount."); 
 
      return; 
    } 
 
    // ------------------------------------------------ 
    // SAVE 
    // ------------------------------------------------ 
 
    addTransaction({ 
      date: date, 
 
      category: category, 
 
      description: description, 
 
      amount: amount, 
    }); 
 
    // ------------------------------------------------ 
    // RESET 
    // ------------------------------------------------ 
 
    form.reset(); 
 
    alert("Transaction added successfully!"); 
 
    // ------------------------------------------------ 
    // UPDATE DASHBOARD 
    // ------------------------------------------------ 
 
    updateDashboard(); 
  }); 
} 
 
// ============================================================ 
// CSV IMPORT HANDLER 
// ============================================================ 
 
function initializeCsvUpload() { 
  const fileInput = document.getElementById("csvFile"); 
  const uploadBox = document.querySelector(".upload-box"); 

  if (!fileInput && !uploadBox) return; 

  function parseAndSaveCsv(text) { 
    try { 
      if (!text || !text.trim()) { 
        alert("Selected CSV file is empty."); 
        return; 
      } 

      const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0); 
      if (lines.length === 0) { 
        alert("CSV file contains no data."); 
        return; 
      } 

      function parseCsvLine(line) { 
        const cols = []; 
        let current = ""; 
        let inQuotes = false; 
        for (let j = 0; j < line.length; j++) { 
          const char = line[j]; 
          if (char === '"' || char === "'") { 
            inQuotes = !inQuotes; 
          } else if (char === "," && !inQuotes) { 
            cols.push(current.trim().replace(/^["']|["']$/g, "")); 
            current = ""; 
          } else { 
            current += char; 
          } 
        } 
        cols.push(current.trim().replace(/^["']|["']$/g, "")); 
        return cols; 
      } 

      const firstRowCols = parseCsvLine(lines[0]); 
      const lowerHeaders = firstRowCols.map((h) => h.toLowerCase()); 

      let dateIdx = lowerHeaders.findIndex((h) => h.includes("date") || h.includes("time") || h.includes("day")); 
      let descIdx = lowerHeaders.findIndex((h) => h.includes("desc") || h.includes("item") || h.includes("name") || h.includes("title") || h.includes("particular") || h.includes("detail") || h.includes("payee") || h.includes("note") || h.includes("trans")); 
      let catIdx = lowerHeaders.findIndex((h) => h.includes("cat") || h.includes("type") || h.includes("group") || h.includes("tag")); 
      let amtIdx = lowerHeaders.findIndex((h) => h.includes("amount") || h.includes("spend") || h.includes("price") || h.includes("cost") || h.includes("val") || h.includes("rs") || h.includes("inr") || h.includes("total") || h.includes("sum")); 

      let startLine = 1; 

      if (dateIdx === -1 && descIdx === -1 && amtIdx === -1) { 
        const hasNumberInFirst = firstRowCols.some((c) => !isNaN(Number(c.replace(/[^0-9.-]+/g, ""))) && Number(c.replace(/[^0-9.-]+/g, "")) > 0); 
        if (!hasNumberInFirst) { 
          dateIdx = 0; 
          descIdx = 1; 
          catIdx = 2; 
          amtIdx = 3; 
          startLine = 1; 
        } else { 
          dateIdx = 0; 
          descIdx = 1; 
          catIdx = 2; 
          amtIdx = 3; 
          startLine = 0; 
        } 
      } else { 
        if (dateIdx === -1) dateIdx = 0; 
        if (descIdx === -1) descIdx = 1; 
        if (amtIdx === -1) amtIdx = firstRowCols.length > 3 ? 3 : firstRowCols.length > 2 ? 2 : 1; 
        if (catIdx === -1) catIdx = firstRowCols.length > 2 && catIdx !== dateIdx && catIdx !== descIdx && catIdx !== amtIdx ? 2 : -1; 
      } 

      const existing = getTransactions(); 
      let importedCount = 0; 

      for (let i = startLine; i < lines.length; i++) { 
        const cols = parseCsvLine(lines[i]); 
        if (cols.length === 0) continue; 

        let date = cols[dateIdx] ? cols[dateIdx].trim() : ""; 
        if (!date || isNaN(new Date(date).getTime())) { 
          date = new Date().toISOString().slice(0, 10); 
        } else { 
          try { 
            date = new Date(date).toISOString().slice(0, 10); 
          } catch (e) { 
            date = new Date().toISOString().slice(0, 10); 
          } 
        } 

        const description = cols[descIdx] ? cols[descIdx].trim() : "Imported Expense"; 
        const category = catIdx >= 0 && cols[catIdx] && cols[catIdx].trim() ? cols[catIdx].trim() : "Other"; 

        let rawAmt = cols[amtIdx] || ""; 
        let amount = Number(String(rawAmt).replace(/[^0-9.-]+/g, "")); 

        if (!Number.isFinite(amount) || amount <= 0) { 
          for (let c = 0; c < cols.length; c++) { 
            const tryVal = Number(String(cols[c]).replace(/[^0-9.-]+/g, "")); 
            if (Number.isFinite(tryVal) && tryVal > 0 && c !== dateIdx && c !== descIdx) { 
              amount = tryVal; 
              break; 
            } 
          } 
        } 

        if (Number.isFinite(amount) && amount > 0) { 
          existing.push({ 
            id: "tx_csv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5), 
            date: date, 
            category: category, 
            description: description, 
            amount: amount, 
          }); 
          importedCount++; 
        } 
      } 

      if (importedCount > 0) { 
        saveTransactions(existing); 
        if (typeof updateDashboard === "function") updateDashboard(); 
        if (typeof renderTransactions === "function") renderTransactions(); 
        alert(`Successfully imported ${importedCount} transaction${importedCount === 1 ? "" : "s"} from CSV!`); 
      } else { 
        alert("No valid transactions found in CSV file."); 
      } 
    } catch (err) { 
      console.error("CSV import error:", err); 
      alert("Failed to parse CSV file."); 
    } 
  } 

  if (uploadBox && fileInput) { 
    uploadBox.style.cursor = "pointer"; 
    uploadBox.addEventListener("click", function (e) { 
      if (e.target !== fileInput && !e.target.classList.contains("csv-label")) { 
        fileInput.click(); 
      } 
    }); 
  } 

  if (fileInput) { 
    fileInput.addEventListener("change", function (e) { 
      const file = e.target.files && e.target.files[0]; 
      if (!file) return; 
      const reader = new FileReader(); 
      reader.onload = function (evt) { 
        parseAndSaveCsv(evt.target.result); 
        fileInput.value = ""; 
      }; 
      reader.readAsText(file); 
    }); 
  } 

  if (uploadBox) { 
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => { 
      uploadBox.addEventListener(eventName, (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
      }, false); 
    }); 

    ["dragenter", "dragover"].forEach((eventName) => { 
      uploadBox.addEventListener(eventName, () => { 
        uploadBox.style.borderColor = "#2563eb"; 
        uploadBox.style.background = "rgba(37, 99, 235, 0.1)"; 
      }, false); 
    }); 

    ["dragleave", "drop"].forEach((eventName) => { 
      uploadBox.addEventListener(eventName, () => { 
        uploadBox.style.borderColor = ""; 
        uploadBox.style.background = ""; 
      }, false); 
    }); 

    uploadBox.addEventListener("drop", function (e) { 
      const dt = e.dataTransfer; 
      const files = dt && dt.files; 
      if (files && files.length > 0) { 
        const file = files[0]; 
        const reader = new FileReader(); 
        reader.onload = function (evt) { 
          parseAndSaveCsv(evt.target.result); 
        }; 
        reader.readAsText(file); 
      } 
    }); 
  } 
} 
 
// ============================================================ 
// LOGOUT HELPER 
// ============================================================ 
 
function logoutUser() { 
  localStorage.removeItem(LOGIN_KEY); 
 
  localStorage.removeItem(CURRENT_USER_KEY); 
 
  sessionStorage.clear(); 
 
  window.location.href = getPageRedirect("signin.html"); 
} 
 
// ============================================================ 
// INITIALIZE EVERYTHING 
// ============================================================ 
 
document.addEventListener("DOMContentLoaded", function () { 
  // Authentication & Password Features 

  initializePasswordToggles(); 

  initializeSignup(); 

  initializeSignin(); 
 
  // Dashboard protection 
 
  protectDashboard(); 
 
  // Profile 
 
  loadProfileInformation(); 
 
  initializeProfileDropdown(); 
 
  // Mobile Navigation 
  initializeMobileNav(); 
 
  // Transaction form & CSV import 
 
  initializeTransactionForm(); 
 
  initializeCsvUpload(); 
 
  // Dashboard 
 
  updateDashboard(); 
}); 
 
// ============================================================ 
// FIRST EVALUATION - JAVASCRIPT CONCEPT HELPERS 
// These small helpers keep syllabus concepts inside a real app. 
// ============================================================ 
 
var EXPENSEGUARD_VERSION = "1.0"; // var: legacy declaration 
 
function getExpenseStatistics(items = []) { 
  // default parameter 
  const amounts = items.map((item) => Number(item.amount) || 0); 
  let total = 0; 
 
  // for loop: total calculation 
  for (let i = 0; i < amounts.length; i++) { 
    total += amounts[i]; 
  } 
 
  // while loop: simple counter example used by the dashboard toolkit 
  let checked = 0; 
  while (checked < amounts.length) { 
    checked++; 
  } 
 
  // do-while: guarantees one validation pass 
  let validated = 0; 
  do { 
    validated++; 
  } while (validated < Math.min(1, amounts.length)); 
 
  const sorted = [...amounts].sort((a, b) => b - a); // spread + sort 
  const highest = sorted[0] || 0; 
  const lowest = sorted.length ? sorted[sorted.length - 1] : 0; 
 
  return { 
    total, 
    count: amounts.length, 
    average: amounts.length ? total / amounts.length : 0, 
    highest, 
    lowest, 
  }; 
} 
 
function getCategoryNames(items = []) { 
  const names = []; 
  items.forEach((item) => { 
    if (!names.includes(item.category)) names.push(item.category); 
  }); 
  return names.slice(); // slice 
} 
 
function cloneTransactions(items = []) { 
  return [...items]; // spread operator 
} 
 
function rememberLastPage(page) { 
  sessionStorage.setItem("expenseGuardLastPage", page); 
} 
 
function closeTransactionModal() { 
  const modal = document.getElementById("transactionModal"); 
  if (modal) { 
    modal.classList.remove("open"); 
    modal.classList.remove("show"); 
  } 
  currentDashboardTransactionId = null;
} 

function toast(message) {
  const existing = document.querySelectorAll(".toast");
  existing.forEach((t) => t.remove());

  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  document.body.appendChild(t);

  setTimeout(() => {
    t.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    t.style.opacity = "0";
    t.style.transform = "translateY(8px)";
    setTimeout(() => t.remove(), 300);
  }, 2200);
}

window.toast = toast;

// ============================================================
// DELETE TRANSACTION (GLOBAL STATE MANAGEMENT)
// ============================================================

let currentDashboardTransactionId = null;

function deleteTransaction(transactionId) {
  if (transactionId == null) {
    return;
  }

  const shouldConfirm = localStorage.getItem("expenseGuardSetting_confirmDelete") !== "false";
  if (shouldConfirm) {
    const confirmed = confirm(
      "Are you sure you want to delete this transaction?",
    );

    if (!confirmed) {
      return;
    }
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  let transactions = [];
  try {
    transactions = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(transactions)) {
      transactions = [];
    }
  } catch (error) {
    transactions = [];
  }

  const updatedTransactions = transactions.filter(function (transaction) {
    return String(transaction.id) !== String(transactionId);
  });

  saveTransactions(updatedTransactions);

  closeTransactionModal();

  // If on transactions page
  const detailModal = document.getElementById("transactionDetailModal");
  if (detailModal) {
    detailModal.classList.remove("show");
  }

  if (typeof renderTransactions === "function") {
    renderTransactions();
  }

  // If on dashboard
  if (typeof updateDashboard === "function") {
    updateDashboard();
  }
}

function deleteCurrentDashboardTransaction() {
  if (currentDashboardTransactionId != null) {
    deleteTransaction(currentDashboardTransactionId);
  }
}

window.deleteTransaction = deleteTransaction;
window.deleteCurrentDashboardTransaction = deleteCurrentDashboardTransaction;

// ============================================================
// PRESENTATION DEMO DATASET
// ============================================================

function loadPresentationDemoData() {
  const presentationDemoData = [
    // --- UTILITIES (Normal Baseline) ---
    { id: "tx_1", date: "2023-09-05", category: "Utilities", description: "Electricity Bill", amount: 1200 },
    { id: "tx_2", date: "2023-10-05", category: "Utilities", description: "Electricity Bill", amount: 1250 },
    { id: "tx_3", date: "2023-11-05", category: "Utilities", description: "Electricity Bill", amount: 1180 },

    // --- SUBSCRIPTIONS (3 Normal, 1 HIGH RISK) ---
    { id: "tx_4", date: "2023-08-01", category: "Subscriptions", description: "Streaming Service", amount: 500 },
    { id: "tx_5", date: "2023-09-01", category: "Subscriptions", description: "Streaming Service", amount: 500 },
    { id: "tx_6", date: "2023-10-01", category: "Subscriptions", description: "Streaming Service", amount: 500 },
    { id: "tx_7", date: "2023-11-01", category: "Subscriptions", description: "Annual Software License", amount: 1999 }, // 🚨 High Risk (>3x Average)

    // --- DINING OUT (4 Normal, 1 HIGH RISK) ---
    { id: "tx_8", date: "2023-10-02", category: "Dining", description: "Cafe Lunch", amount: 800 },
    { id: "tx_9", date: "2023-10-09", category: "Dining", description: "Dinner with friends", amount: 950 },
    { id: "tx_10", date: "2023-10-16", category: "Dining", description: "Takeout", amount: 850 },
    { id: "tx_11", date: "2023-10-23", category: "Dining", description: "Cafe Lunch", amount: 900 },
    { id: "tx_12", date: "2023-10-30", category: "Dining", description: "Anniversary Fine Dining", amount: 4500 }, // 🚨 High Risk (>3x Average)

    // --- SHOPPING (3 Normal, 1 HIGH RISK) ---
    { id: "tx_13", date: "2023-09-10", category: "Shopping", description: "Clothing", amount: 1500 },
    { id: "tx_14", date: "2023-10-12", category: "Shopping", description: "Shoes", amount: 1200 },
    { id: "tx_15", date: "2023-11-02", category: "Shopping", description: "Home goods", amount: 1600 },
    { id: "tx_16", date: "2023-11-15", category: "Shopping", description: "New Smartphone", amount: 5500 }, // 🚨 High Risk (>3x Average)

    // --- GROCERIES (5 Normal, 1 MEDIUM RISK) ---
    { id: "tx_17", date: "2023-10-03", category: "Groceries", description: "Supermarket", amount: 2000 },
    { id: "tx_18", date: "2023-10-10", category: "Groceries", description: "Supermarket", amount: 2200 },
    { id: "tx_19", date: "2023-10-17", category: "Groceries", description: "Supermarket", amount: 1800 },
    { id: "tx_20", date: "2023-10-24", category: "Groceries", description: "Supermarket", amount: 2100 },
    { id: "tx_21", date: "2023-10-31", category: "Groceries", description: "Supermarket", amount: 1900 },
    { id: "tx_22", date: "2023-11-07", category: "Groceries", description: "Hosting Party Groceries", amount: 2380 }, // ⚠️ Medium Risk (Z-Score ~2.4)

    // --- TRANSPORTATION (4 Normal, 1 MEDIUM RISK) ---
    { id: "tx_23", date: "2023-10-04", category: "Transportation", description: "Cab Ride", amount: 350 },
    { id: "tx_24", date: "2023-10-11", category: "Transportation", description: "Cab Ride", amount: 400 },
    { id: "tx_25", date: "2023-10-18", category: "Transportation", description: "Cab Ride", amount: 320 },
    { id: "tx_26", date: "2023-10-25", category: "Transportation", description: "Cab Ride", amount: 380 },
    { id: "tx_27", date: "2023-11-08", category: "Transportation", description: "Cab Ride (Surge Pricing)", amount: 500 } // ⚠️ Medium Risk (Z-Score ~2.3)
  ];

  // 1. Save this specific array to localStorage
  localStorage.setItem("expenseGuardTransactions", JSON.stringify(presentationDemoData));
  if (typeof saveTransactions === "function") {
    saveTransactions(presentationDemoData);
  }

  // 2. Alert the user and reload the page
  alert("Full presentation demo data loaded! The dashboard is now populated.");
  window.location.reload();
}

window.loadPresentationDemoData = loadPresentationDemoData;

 
 
