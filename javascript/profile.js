// ============================================================
// EXPENSEGUARD — PROFILE JAVASCRIPT
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  let user = (typeof getCurrentUser === "function" && getCurrentUser()) || {
    name: "My Account",
    email: "Not signed in",
  };

  const nameInput = document.getElementById("profileNameInput");
  const emailInput = document.getElementById("profileEmailInput");

  if (nameInput) nameInput.value = user.name || "";
  if (emailInput) emailInput.value = user.email || "";

  function paint() {
    const profileTitle = document.getElementById("profileTitle");
    const profileEmail = document.getElementById("profileEmail");
    const bigInitials = document.getElementById("bigInitials");
    const profileCount = document.getElementById("profileCount");
    const profileSpend = document.getElementById("profileSpend");

    if (profileTitle) profileTitle.textContent = user.name || "My Account";
    if (profileEmail) profileEmail.textContent = user.email || "Not signed in";
    if (bigInitials && typeof getUserInitials === "function") {
      bigInitials.textContent = getUserInitials(user.name);
    }

    const tx = typeof getTransactions === "function" ? getTransactions() : [];
    if (profileCount) profileCount.textContent = tx.length;
    if (profileSpend) {
      profileSpend.textContent =
        "₹" +
        tx
          .reduce((s, t) => s + Number(t.amount || 0), 0)
          .toLocaleString("en-IN");
    }
  }

  paint();

  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      user = {
        name: nameInput ? nameInput.value.trim() : "",
        email: emailInput ? emailInput.value.trim() : "",
      };
      localStorage.setItem("expenseGuardCurrentUser", JSON.stringify(user));
      localStorage.setItem("expenseGuardLoggedIn", "true");
      paint();

      const t = document.createElement("div");
      t.className = "toast";
      t.textContent = "Profile updated";
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2000);
    });
  }
});
