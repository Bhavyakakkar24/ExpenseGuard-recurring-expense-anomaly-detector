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
 
// Immediately apply theme 
applyTheme(); 
if (document.readyState === "loading") { 
  document.addEventListener("DOMContentLoaded", () => applyTheme()); 
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
// ANOMALY DETECTION 
// ============================================================ 
 
function analyzeTransactions(transactions) { 
  if (transactions.length === 0) { 
    return []; 
  } 
 
  const categoryAmounts = {}; 
 
  transactions.forEach((transaction) => { 
    if (!categoryAmounts[transaction.category]) { 
      categoryAmounts[transaction.category] = []; 
    } 
 
    categoryAmounts[transaction.category].push(Number(transaction.amount)); 
  }); 
 
  return transactions.map((transaction) => { 
    const values = categoryAmounts[transaction.category]; 
 
    const zScore = calculateZScore(Number(transaction.amount), values); 
 
    const isAnomaly = Math.abs(zScore) >= 2; 
 
    return { 
      ...transaction, 
 
      zScore: Number(zScore.toFixed(2)), 
 
      isAnomaly: isAnomaly, 
    }; 
  }); 
} 
 
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
  const name = user?.name || "My Account"; 
  const email = user?.email || (user ? "" : "Not signed in"); 
  const initials = user ? getUserInitials(name) : "EG"; 
 
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
      const lines = text.trim().split(/\r?\n/); 
      if (lines.length < 2) { 
        alert("CSV file is empty or missing headers."); 
        return; 
      } 
 
      const headers = lines[0] 
        .split(",") 
        .map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase()); 
      const dateIdx = headers.findIndex((h) => h.includes("date")); 
      const descIdx = headers.findIndex((h) => h.includes("desc")); 
      const catIdx = headers.findIndex((h) => h.includes("cat")); 
      const amtIdx = headers.findIndex( 
        (h) => 
          h.includes("amount") || 
          h.includes("spend") || 
          h.includes("price") || 
          h.includes("cost"), 
      ); 
 
      if (dateIdx === -1 || descIdx === -1 || amtIdx === -1) { 
        alert("CSV must contain Date, Description, and Amount columns."); 
        return; 
      } 
 
      const existing = getTransactions(); 
      let importedCount = 0; 
 
      for (let i = 1; i < lines.length; i++) { 
        const line = lines[i].trim(); 
        if (!line) continue; 
 
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
 
        const date = cols[dateIdx] || new Date().toISOString().slice(0, 10); 
        const description = cols[descIdx] || "Imported expense"; 
        const category = 
          catIdx >= 0 && cols[catIdx] ? cols[catIdx] : "Other"; 
        const amount = Number( 
          String(cols[amtIdx] || "").replace(/[^0-9.-]+/g, ""), 
        ); 
 
        if (Number.isFinite(amount) && amount > 0) { 
          existing.push({ 
            id: Date.now() + i, 
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
        updateDashboard(); 
        alert( 
          `Successfully imported ${importedCount} transaction${importedCount === 1 ? "" : "s"}!`, 
        ); 
      } else { 
        alert("No valid transactions found in CSV."); 
      } 
    } catch (err) { 
      console.error("CSV import error:", err); 
      alert("Failed to parse CSV file."); 
    } 
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
    uploadBox.addEventListener("dragover", function (e) { 
      e.preventDefault(); 
      uploadBox.style.borderColor = "var(--teal, #27d3bd)"; 
    }); 
 
    uploadBox.addEventListener("dragleave", function () { 
      uploadBox.style.borderColor = ""; 
    }); 
 
    uploadBox.addEventListener("drop", function (e) { 
      e.preventDefault(); 
      uploadBox.style.borderColor = ""; 
      const file = e.dataTransfer.files && e.dataTransfer.files[0]; 
      if (file) { 
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
  } 
} 
 
