// ============================================================
// EXPENSEGUARD - TRANSACTIONS PAGE
// COMPLETE FIXED VERSION
// ============================================================

(function () {
  "use strict";

  // ========================================================
  // STORAGE
  // ========================================================

  const STORAGE_KEY = "expenseGuardTransactions";

  // ========================================================
  // GET TRANSACTIONS
  // ========================================================

  function getTransactions() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return [];
      }

      const data = JSON.parse(stored);

      if (!Array.isArray(data)) {
        return [];
      }

      return data;
    } catch (error) {
      console.error("Could not read transactions:", error);

      return [];
    }
  }

  // ========================================================
  // SAVE TRANSACTIONS
  // ========================================================

  function saveTransactions(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));

      return true;
    } catch (error) {
      console.error("Could not save transactions:", error);

      return false;
    }
  }

  // ========================================================
  // FORMAT DATE
  // ========================================================

  function formatDate(dateString) {
    if (!dateString) {
      return "-";
    }

    try {
      const date = new Date(dateString + "T00:00:00");

      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  }

  // ========================================================
  // ESCAPE HTML
  // ========================================================

  function escapeHTML(value) {
    const div = document.createElement("div");

    div.textContent = value == null ? "" : String(value);

    return div.innerHTML;
  }

  // ========================================================
  // MEAN
  // ========================================================

  function calculateMean(values) {
    if (!values.length) {
      return 0;
    }

    let total = 0;

    values.forEach(function (value) {
      total += Number(value) || 0;
    });

    return total / values.length;
  }

  // ========================================================
  // STANDARD DEVIATION
  // ========================================================

  function calculateStandardDeviation(values) {
    if (values.length <= 1) {
      return 0;
    }

    const mean = calculateMean(values);

    let total = 0;

    values.forEach(function (value) {
      const difference = (Number(value) || 0) - mean;

      total += difference * difference;
    });

    const variance = total / values.length;

    return Math.sqrt(variance);
  }

  // ========================================================
  // Z-SCORE
  // ========================================================

  function calculateZScore(amount, categoryValues) {
    if (categoryValues.length <= 1) {
      return 0;
    }

    const mean = calculateMean(categoryValues);

    const standardDeviation = calculateStandardDeviation(categoryValues);

    if (!Number.isFinite(standardDeviation) || standardDeviation === 0) {
      return 0;
    }

    return (Number(amount) - mean) / standardDeviation;
  }

  // ========================================================
  // ANALYZE TRANSACTIONS
  // ========================================================

  function analyzeTransactions(transactions) {
    if (!transactions.length) {
      return [];
    }

    // -----------------------------------------------
    // Group amounts by category
    // -----------------------------------------------

    const categoryAmounts = {};

    transactions.forEach(function (transaction) {
      const category = transaction.category || "Other";

      if (!categoryAmounts[category]) {
        categoryAmounts[category] = [];
      }

      categoryAmounts[category].push(Number(transaction.amount) || 0);
    });

    // -----------------------------------------------
    // Calculate Z-score for each transaction
    // -----------------------------------------------

    return transactions.map(function (transaction) {
      const category = transaction.category || "Other";

      const values = categoryAmounts[category] || [];

      const zScore = calculateZScore(Number(transaction.amount) || 0, values);

      const roundedZScore = Number(zScore.toFixed(2));

      return {
        ...transaction,

        zScore: roundedZScore,

        isAnomaly: Math.abs(roundedZScore) >= 2,
      };
    });
  }

  // ========================================================
  // RENDER TRANSACTIONS
  // ========================================================

  function renderTransactions() {
    const tableBody = document.getElementById("transactionTable");

    if (!tableBody) {
      console.error("ERROR: #transactionTable not found.");

      return;
    }

    const transactions = getTransactions();

    console.log("Transactions loaded:", transactions);

    // Clear table

    tableBody.innerHTML = "";

    // -----------------------------------------------
    // No transactions
    // -----------------------------------------------

    if (transactions.length === 0) {
      tableBody.innerHTML = `

                <tr>

                    <td colspan="7"
                        class="empty-message">

                        No transactions recorded yet.

                    </td>

                </tr>

            `;

      return;
    }

    // -----------------------------------------------
    // Analyze
    // -----------------------------------------------

    const analyzed = analyzeTransactions(transactions);

    // -----------------------------------------------
    // Newest first
    // -----------------------------------------------

    analyzed
      .slice()
      .sort(function (a, b) {
        const dateA = new Date(a.date || 0).getTime();

        const dateB = new Date(b.date || 0).getTime();

        return dateB - dateA;
      })
      .forEach(function (transaction) {
        const row = document.createElement("tr");

        row.dataset.category = transaction.category || "Other";

        row.dataset.status = transaction.isAnomaly ? "Anomaly" : "Normal";

        row.innerHTML = `

                    <td>
                        ${formatDate(transaction.date)}
                    </td>

                    <td>
                        ${escapeHTML(transaction.description)}
                    </td>

                    <td>

                        <span class="category-badge">

                            ${escapeHTML(transaction.category || "Other")}

                        </span>

                    </td>

                    <td class="amount-cell">

                        ₹${Number(transaction.amount || 0).toLocaleString(
                          "en-IN",
                        )}

                    </td>

                    <td>

                        ${Number(transaction.zScore || 0).toFixed(2)}

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

                    <td>
                        <div class="actions-cell">
                            <button
                                type="button"
                                class="view-btn"
                                data-id="${transaction.id}"
                                title="View details"
                            >
                                View
                            </button>
                            <button
                                type="button"
                                class="delete-btn table-delete-btn"
                                data-id="${transaction.id}"
                                title="Delete transaction"
                            >
                                🗑 Delete
                            </button>
                        </div>
                    </td>

                `;

        tableBody.appendChild(row);
      });

    // -----------------------------------------------
    // View buttons
    // -----------------------------------------------

    const viewButtons = tableBody.querySelectorAll(".view-btn");

    viewButtons.forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        const id = this.dataset.id;

        viewTransaction(id);
      });
    });

    // -----------------------------------------------
    // Delete buttons
    // -----------------------------------------------

    const deleteButtons = tableBody.querySelectorAll(".delete-btn");

    deleteButtons.forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        const id = this.dataset.id;

        deleteTransaction(id);
      });
    });

    // -----------------------------------------------
    // Apply filters
    // -----------------------------------------------

    filterTransactions();
  }

  // ========================================================
  // DELETE TRANSACTION
  // ========================================================

  function deleteTransaction(transactionId) {
    if (transactionId == null) {
      return;
    }

    const confirmed = confirm(
      "Are you sure you want to delete this transaction?",
    );

    if (!confirmed) {
      return;
    }

    const transactions = getTransactions();

    const updatedTransactions = transactions.filter(function (transaction) {
      return String(transaction.id) !== String(transactionId);
    });

    const saved = saveTransactions(updatedTransactions);

    if (!saved) {
      alert("Transaction could not be deleted.");
      return;
    }

    // Close detail modal if open
    closeDetailModal();

    // Re-render table immediately
    renderTransactions();
  }

  window.deleteTransaction = deleteTransaction;

  // ========================================================
  // FILTER TRANSACTIONS
  // ========================================================

  function filterTransactions() {
    const searchInput = document.getElementById("searchInput");

    const categoryFilter = document.getElementById("categoryFilter");

    const statusFilter = document.getElementById("statusFilter");

    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const category = categoryFilter ? categoryFilter.value : "All Categories";

    const status = statusFilter ? statusFilter.value : "All Status";

    const rows = document.querySelectorAll("#transactionTable tr");

    rows.forEach(function (row) {
      // Empty message

      if (!row.dataset.category) {
        return;
      }

      const rowText = row.textContent.toLowerCase();

      const searchMatch = rowText.includes(search);

      const categoryMatch =
        category === "All Categories" || row.dataset.category === category;

      const statusMatch =
        status === "All Status" || row.dataset.status === status;

      if (searchMatch && categoryMatch && statusMatch) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  }

  // ========================================================
  // RESET FILTERS
  // ========================================================

  function resetFilters() {
    console.log("Reset button clicked.");

    const searchInput = document.getElementById("searchInput");

    const categoryFilter = document.getElementById("categoryFilter");

    const statusFilter = document.getElementById("statusFilter");

    if (searchInput) {
      searchInput.value = "";
    }

    if (categoryFilter) {
      categoryFilter.value = "All Categories";
    }

    if (statusFilter) {
      statusFilter.value = "All Status";
    }

    // IMPORTANT:
    // Do NOT reload or delete transactions.
    // Only reset the filters.

    filterTransactions();
  }

  // ========================================================
  // VIEW TRANSACTION & DETAIL MODAL
  // ========================================================

  let currentDetailTransactionId = null;

  function openDetailModal(transaction) {
    const modal = document.getElementById("transactionDetailModal");

    if (!modal) {
      alert(
        "TRANSACTION DETAILS\n\n" +
          "Description: " +
          (transaction.description || "-") +
          "\n\nAmount: ₹" +
          Number(transaction.amount || 0).toLocaleString("en-IN") +
          "\n\nCategory: " +
          (transaction.category || "-") +
          "\n\nDate: " +
          formatDate(transaction.date) +
          "\n\nZ-Score: " +
          Number(transaction.zScore || 0).toFixed(2) +
          "\n\nStatus: " +
          (transaction.isAnomaly ? "ANOMALY" : "NORMAL"),
      );
      return;
    }

    currentDetailTransactionId = transaction.id;

    const descEl = document.getElementById("detailModalDescription");
    const amountEl = document.getElementById("detailModalAmount");
    const dateEl = document.getElementById("detailModalDate");
    const catEl = document.getElementById("detailModalCategory");
    const zEl = document.getElementById("detailModalZScore");
    const statusEl = document.getElementById("detailModalStatus");
    const warningEl = document.getElementById("detailModalWarning");

    if (descEl) descEl.textContent = transaction.description || "Transaction Details";
    if (amountEl) amountEl.textContent = "₹" + Number(transaction.amount || 0).toLocaleString("en-IN");
    if (dateEl) dateEl.textContent = formatDate(transaction.date);
    if (catEl) catEl.textContent = transaction.category || "Other";
    if (zEl) zEl.textContent = Number(transaction.zScore || 0).toFixed(2);
    if (statusEl) {
      statusEl.textContent = transaction.isAnomaly ? "⚠ Anomaly" : "✓ Normal";
      statusEl.className = transaction.isAnomaly ? "modal-status status-anomaly" : "modal-status status-normal";
    }

    if (warningEl) {
      warningEl.style.display = transaction.isAnomaly ? "flex" : "none";
    }

    modal.classList.add("show");
  }

  function closeDetailModal() {
    const modal = document.getElementById("transactionDetailModal");
    if (modal) {
      modal.classList.remove("show");
    }
    currentDetailTransactionId = null;
  }

  function viewTransaction(id) {
    const transactions = getTransactions();

    const analyzed = analyzeTransactions(transactions);

    const transaction = analyzed.find(function (item) {
      return String(item.id) === String(id);
    });

    if (!transaction) {
      alert("Transaction not found.");

      return;
    }

    openDetailModal(transaction);
  }

  // ========================================================
  // OPEN ADD TRANSACTION MODAL
  // ========================================================

  function openAddTransaction() {
    console.log("Add Transaction button clicked.");

    const modal = document.getElementById("transactionModal");

    if (!modal) {
      console.error("Transaction modal not found.");

      return;
    }

    modal.classList.add("show");

    const dateInput = document.getElementById("modalTransactionDate");

    if (dateInput && !dateInput.value) {
      const today = new Date().toISOString().split("T")[0];

      dateInput.value = today;
    }
  }

  // ========================================================
  // CLOSE MODAL
  // ========================================================

  function closeAddTransaction() {
    const modal = document.getElementById("transactionModal");

    if (!modal) {
      return;
    }

    modal.classList.remove("show");
  }

  // ========================================================
  // ADD TRANSACTION
  // ========================================================

  function addTransaction(event) {
    event.preventDefault();

    console.log("Transaction form submitted.");

    // -----------------------------------------------
    // Get form values
    // -----------------------------------------------

    const dateInput = document.getElementById("modalTransactionDate");

    const categoryInput = document.getElementById("modalTransactionCategory");

    const descriptionInput = document.getElementById(
      "modalTransactionDescription",
    );

    const amountInput = document.getElementById("modalTransactionAmount");

    if (!dateInput || !categoryInput || !descriptionInput || !amountInput) {
      console.error("One or more transaction form fields are missing.");

      return;
    }

    const date = dateInput.value;

    const category = categoryInput.value;

    const description = descriptionInput.value.trim();

    const amount = Number(amountInput.value);

    // -----------------------------------------------
    // Validation
    // -----------------------------------------------

    if (!date) {
      alert("Please select a date.");

      return;
    }

    if (!category) {
      alert("Please select a category.");

      return;
    }

    if (!description) {
      alert("Please enter a description.");

      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid amount.");

      return;
    }

    // -----------------------------------------------
    // Get existing transactions
    // -----------------------------------------------

    const transactions = getTransactions();

    // -----------------------------------------------
    // Create transaction
    // -----------------------------------------------

    const transaction = {
      id: Date.now(),

      date: date,

      category: category,

      description: description,

      amount: amount,
    };

    // -----------------------------------------------
    // Add
    // -----------------------------------------------

    transactions.push(transaction);

    // -----------------------------------------------
    // Save
    // -----------------------------------------------

    const saved = saveTransactions(transactions);

    if (!saved) {
      alert("Transaction could not be saved.");

      return;
    }

    console.log("Transaction saved:", transaction);

    console.log("All transactions:", getTransactions());

    // -----------------------------------------------
    // Reset form
    // -----------------------------------------------

    const form = document.getElementById("transactionModalForm");

    if (form) {
      form.reset();
    }

    // -----------------------------------------------
    // Close modal
    // -----------------------------------------------

    closeAddTransaction();

    // -----------------------------------------------
    // Refresh table
    // -----------------------------------------------

    renderTransactions();

    alert("Transaction added successfully!");
  }

  // ========================================================
  // PROFILE DROPDOWN
  // ========================================================

  function setupProfile() {
    const button = document.getElementById("profileButton");

    const wrapper = document.getElementById("profileWrapper");

    const dropdown = document.getElementById("profileDropdown");

    const logoutButton = document.getElementById("logoutButton");

    if (!button || !wrapper) {
      console.warn("Profile elements not found.");

      return;
    }

    // -----------------------------------------------
    // Profile button
    // -----------------------------------------------

    button.addEventListener("click", function (event) {
      event.preventDefault();

      event.stopPropagation();

      wrapper.classList.toggle("open");
    });

    // -----------------------------------------------
    // Dropdown
    // -----------------------------------------------

    if (dropdown) {
      dropdown.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    }

    // -----------------------------------------------
    // Click outside
    // -----------------------------------------------

    document.addEventListener("click", function () {
      wrapper.classList.remove("open");
    });

    // -----------------------------------------------
    // Escape
    // -----------------------------------------------

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        wrapper.classList.remove("open");
      }
    });

    // -----------------------------------------------
    // Logout
    // -----------------------------------------------

    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        localStorage.removeItem("expenseGuardLoggedIn");

        localStorage.removeItem("expenseGuardCurrentUser");

        window.location.href = "signin.html";
      });
    }
  }

  // ========================================================
  // LOAD PROFILE DATA
  // ========================================================

  function loadProfileData() {
    let user = null;

    try {
      const storedUser = localStorage.getItem("expenseGuardCurrentUser");

      if (storedUser) {
        user = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error("Could not load user:", error);
    }

    if (!user) {
      return;
    }

    const name = user.name || "My Account";

    const email = user.email || "";

    const parts = name.trim().split(/\s+/);

    let initials = "BK";

    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1) {
      initials = parts[0].substring(0, 2).toUpperCase();
    }

    const profileName = document.getElementById("profileName");

    const profileInitials = document.getElementById("profileInitials");

    const dropdownName = document.getElementById("dropdownName");

    const dropdownEmail = document.getElementById("dropdownEmail");

    const dropdownInitials = document.getElementById("dropdownInitials");

    if (profileName) {
      profileName.textContent = name;
    }

    if (profileInitials) {
      profileInitials.textContent = initials;
    }

    if (dropdownName) {
      dropdownName.textContent = name;
    }

    if (dropdownEmail) {
      dropdownEmail.textContent = email;
    }

    if (dropdownInitials) {
      dropdownInitials.textContent = initials;
    }
  }

  // ========================================================
  // INITIALIZE
  // ========================================================

  function initializeTransactionsPage() {
    console.log("=================================");

    console.log("ExpenseGuard Transactions JS loaded");

    console.log("=================================");

    console.log("Stored transaction data:", localStorage.getItem(STORAGE_KEY));

    // -----------------------------------------------
    // Profile
    // -----------------------------------------------

    setupProfile();

    loadProfileData();

    // -----------------------------------------------
    // Initial table
    // -----------------------------------------------

    renderTransactions();

    // -----------------------------------------------
    // Search
    // -----------------------------------------------

    const searchInput = document.getElementById("searchInput");

    if (searchInput) {
      searchInput.addEventListener("input", filterTransactions);
    }

    // -----------------------------------------------
    // Category
    // -----------------------------------------------

    const categoryFilter = document.getElementById("categoryFilter");

    if (categoryFilter) {
      categoryFilter.addEventListener("change", filterTransactions);
    }

    // -----------------------------------------------
    // Status
    // -----------------------------------------------

    const statusFilter = document.getElementById("statusFilter");

    if (statusFilter) {
      statusFilter.addEventListener("change", filterTransactions);
    }

    // -----------------------------------------------
    // RESET
    // -----------------------------------------------

    const resetButton = document.getElementById("resetFilters");

    if (resetButton) {
      resetButton.addEventListener("click", function (event) {
        event.preventDefault();

        resetFilters();
      });
    }

    // -----------------------------------------------
    // ADD TRANSACTION
    // -----------------------------------------------

    const openButton = document.getElementById("openAddButton");

    if (openButton) {
      openButton.addEventListener("click", function (event) {
        event.preventDefault();

        openAddTransaction();
      });
    }

    // -----------------------------------------------
    // CLOSE MODAL
    // -----------------------------------------------

    const closeButton = document.getElementById("closeModalButton");

    if (closeButton) {
      closeButton.addEventListener("click", function (event) {
        event.preventDefault();

        closeAddTransaction();
      });
    }

    // -----------------------------------------------
    // CANCEL MODAL
    // -----------------------------------------------

    const cancelButton = document.getElementById("cancelModalButton");

    if (cancelButton) {
      cancelButton.addEventListener("click", function (event) {
        event.preventDefault();

        closeAddTransaction();
      });
    }

    // -----------------------------------------------
    // FORM SUBMIT
    // -----------------------------------------------

    const modalForm = document.getElementById("transactionModalForm");

    if (modalForm) {
      modalForm.addEventListener("submit", addTransaction);
    }

    // -----------------------------------------------
    // Click outside modal
    // -----------------------------------------------

    const modal = document.getElementById("transactionModal");

    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) {
          closeAddTransaction();
        }
      });
    }

    // -----------------------------------------------
    // TRANSACTION DETAIL MODAL LISTENERS
    // -----------------------------------------------

    const closeDetailBtn = document.getElementById("closeDetailModalButton");
    if (closeDetailBtn) {
      closeDetailBtn.addEventListener("click", function (event) {
        event.preventDefault();
        closeDetailModal();
      });
    }

    const cancelDetailBtn = document.getElementById("cancelDetailModalBtn");
    if (cancelDetailBtn) {
      cancelDetailBtn.addEventListener("click", function (event) {
        event.preventDefault();
        closeDetailModal();
      });
    }

    const detailDeleteBtn = document.getElementById("detailModalDeleteBtn");
    if (detailDeleteBtn) {
      detailDeleteBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (currentDetailTransactionId != null) {
          deleteTransaction(currentDetailTransactionId);
        }
      });
    }

    const detailModal = document.getElementById("transactionDetailModal");
    if (detailModal) {
      detailModal.addEventListener("click", function (event) {
        if (event.target === detailModal) {
          closeDetailModal();
        }
      });
    }

    // -----------------------------------------------
    // Escape closes modal
    // -----------------------------------------------

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAddTransaction();
        closeDetailModal();
      }
    });
  }

  // ========================================================
  // START AFTER HTML LOADS
  // ========================================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeTransactionsPage);
  } else {
    initializeTransactionsPage();
  }
})();
