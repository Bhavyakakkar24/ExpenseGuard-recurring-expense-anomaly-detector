# ExpenseGuard — Recurring Expense Anomaly Detector

ExpenseGuard is a modern, web-based expense management and statistical anomaly detection application designed to help users track expenses, organize spending by category, set category budgets, generate financial reports, and automatically detect unusual spending patterns.

🌍 **Live Demo:** [View Live on Vercel](https://expense-guard-recurring-expense-ano.vercel.app/)

---

## 🚀 Local Development (How to Run Locally)

If you want to run the project locally on your machine, you can use any of the following methods:

**Option 1: Using Python HTTP Server (Recommended)**
```bash
# Navigate to the project root directory
cd recurring-expense-anomaly-detector-main

# Start a local web server
python -m http.server 8000
```
Then open your browser and navigate to: `http://localhost:8000/`

**Option 2: Using VS Code Live Server**
1. Open the project folder in VS Code.
2. Right-click `index.html` or `pages/welcome.html`.
3. Select **Open with Live Server**.

**Option 3: Direct Browser Access**
* Double-click `index.html` in your file explorer to open directly in any modern web browser.

---

## 📌 Project Overview

Managing recurring expenses can make it difficult to spot subtle or unexpected spending anomalies. ExpenseGuard provides an intuitive, responsive interface with a dark navy finance aesthetic where users can:
* **Track Expenses:** Record dates, categories, descriptions, and amounts.
* **Import/Export Data:** Upload CSV expense logs or export records for external analysis.
* **Smart Category Breakdown:** Group spending dynamically using JavaScript data structures and visualizations.
* **Budget Health Tracking:** Set monthly limits per category and monitor real-time spending progress.
* **Statistical Anomaly Detection:** Identify spending outliers using Z-score calculation per category.
* **Spending Intelligence Reports:** Generate quick statistical summaries and export printable report logs.
* **Customizable Settings & Evaluation Lab:** Configure themes, currency, default categories, and run verification routines.
* **User Authentication & Profile:** Secure client-side authentication with session and profile management.

---

## ✨ Features & Pages

### 1. 🏠 Welcome & Authentication 
*(welcome.html, signup.html, signin.html)*
* Clean onboarding with visual finance cards.
* Registration with validation (password length, confirmation check, duplicate email prevention).
* Sign-in session state persisted in `localStorage`.
* Protected routing guarding dashboard and sub-pages against unauthorized access.

### 2. 📊 Dashboard 
*(dashboard.html)*
* Total spending summary, total transaction count, detected anomalies count, and average expense metrics.
* Manual transaction creation form with input validation.
* CSV drag-and-drop / file upload import for bulk transaction ingestion.
* Dynamic category progress bars and spending distribution.
* Live anomaly alerts list and recent transaction table.

### 3. 💳 Transactions Management 
*(transactions.html)*
* Interactive transaction data table sorted newest-first.
* Real-time search across descriptions and categories.
* Category filter and anomaly status filter (All, Normal, Anomaly).
* Detail view modal displaying transaction attributes and Z-score metrics.
* Modal form for creating new transactions.

### 4. ⚠️ Anomaly Center & Risk Monitor 
*(anomalies.html)*
* Portfolio risk gauge and risk percentage status.
* Filter anomalies by risk level (All, High, Medium).
* Sort by amount, Z-score intensity, or date.
* Detailed explanation cards indicating why each expense was flagged.
* Interactive demo anomaly generator.

### 5. ▣ Smart Category Analysis 
*(categories.html)*
* Summary statistics: Total spending, top category, categories used, average per category.
* Interactive category search and sort (Highest spending, Most transactions, A-Z).
* Dynamic conic-gradient donut chart visualization with color-coded legend.
* Category spending cards with progress bars and highest expense highlights.
* Automated spending insight bullet points.

### 6. ◫ Budget Limits & Health 
*(budgets.html)*
* Create category-specific monthly spending limits.
* Real-time progress bars comparing actual spending with defined limits.
* Visual alerts for nearing limit (>=80%) and over-budget (>=100%) states.
* Easy budget removal with one-click action.

### 7. ▤ Spending Intelligence Reports 
*(reports.html)*
* Key metric cards: Total Spending, Average Expense, Top Category, High Value Expense.
* Category performance distribution.
* Top 5 largest recorded transactions.
* Monthly spending chronological summaries.
* One-click report text export (`.txt`).

### 8. 👤 User Profile 
*(profile.html)*
* Live account summary and avatar initials display.
* Editable user name and email synchronized across session and stored user list.

### 9. ⚙️ Control Center & Settings 
*(settings.html)*
* Multi-panel settings: Account, Preferences, Notifications, Security & Data, Evaluation Lab.
* Theme toggle: Premium Navy Dark mode and Light mode.
* Transaction CSV export, demo data population, and storage clear utilities.
* Interactive Evaluation Lab demonstrating core JS array methods (`map`, `filter`, `reduce`, `sort`).

---

## 🔍 Statistical Anomaly Detection Methodology

ExpenseGuard detects anomalous expenses within each category using the standard normal distribution Z-score metric:

$$Z = \frac{X - \mu}{\sigma}$$

Where:
* $X$: Transaction amount
* $\mu$: Mean (average) spending for transactions in that specific category: $$\mu = \frac{\sum_{i=1}^{N}X_i}{N}$$
* $\sigma$: Standard deviation of spending in that category: $$\sigma = \sqrt{\frac{\sum_{i=1}^{N}(X_i - \mu)^2}{N}}$$

**Classification Criteria:**
* **Normal:** $\vert{}Z\vert{} < 1.8$ (Within expected statistical distribution)
* **Medium Risk:** $1.8 \le \vert{}Z\vert{} < 2.6$ or single-item fallback ratio $\ge 1.6 \times$ global mean.
* **High Risk:** $\vert{}Z\vert{} \ge 2.6$ or amount $\ge 3 \times$ category mean.

---

## 📂 Project Structure

```text
recurring-expense-anomaly-detector-main/
│
├── css/
│   ├── anomalies.css        # Anomaly Center and risk gauge styles
│   ├── auth.css             # Authentication (sign-in, sign-up) styling
│   ├── categories.css       # Smart category tiles and donut chart styles
│   ├── evaluation.css       # Premium Navy dark design system & tokens
│   ├── style.css            # Base layouts, sidebar, headers, tables
│   ├── transaction.css      # Transaction page layout overrides
│   ├── transactions.css     # Transaction table, filters, and modal styling
│   └── welcome.css          # Onboarding / welcome page visual cards
│
├── data/
│   └── sample-transactions.csv # Sample dataset with realistic expenses and anomalies
│
├── javascript/
│   ├── anomalies.js         # Anomaly Center filtering and risk calculation
│   ├── app.js               # Core application logic, auth, storage, dashboard, CSV import
│   ├── budgets.js           # Budget creation, progress calculation, and health
│   ├── categories.js        # Category aggregation, donut chart, and insights
│   ├── profile.js           # Profile editing and summary statistics
│   ├── reports.js           # Financial report generation and export
│   ├── settings.js          # Control center, theme switcher, demo loader, eval lab
│   └── transaction.js       # Transaction table filters, modal, and view details
│
├── pages/
│   ├── anomalies.html       # Anomaly Center page
│   ├── budgets.html         # Budgets management page
│   ├── categories.html      # Category breakdown page
│   ├── profile.html         # User profile page
│   ├── reports.html         # Financial reports page
│   ├── settings.html        # Settings and Evaluation Lab page
│   ├── signin.html          # Sign In page
│   ├── signup.html          # Sign Up / Create Account page
│   ├── transactions.html    # Transactions management page
│   └── welcome.html         # Welcome / Landing page
│
├── dashboard.html           # Main ExpenseGuard dashboard
├── index.html               # Entry point redirecting to welcome page
└── README.md                # Project documentation
```
