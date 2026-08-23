# ExpenseGuard


🚀 How to Run
Clone the repository:
git clone https://github.com/Bhavyakakkar24/recurring-expense-anomaly-detector.git
Open the project folder.
Open index.html in a browser.

For the best development experience, the project can be opened using VS Code with Live Server.


### Recurring Expense Anomaly Detector

ExpenseGuard is a web-based expense management and anomaly detection system designed to help users track their expenses, organize transactions into categories, and identify unusual spending patterns.

---

## 📌 Project Overview

Managing recurring expenses can make it difficult to notice unusual spending patterns.

ExpenseGuard provides a simple interface where users can:

- Track their expenses
- View and manage transactions
- Categorize expenses
- Monitor spending patterns
- Identify potentially unusual transactions
- View expense information through a dashboard
- Manage their profile and account settings

The project uses statistical analysis, including **Z-score based anomaly detection**, to determine whether a transaction significantly differs from other transactions in the same category.

---

## ✨ Features

### 📊 Dashboard
- Overview of expense activity
- Expense statistics
- Transaction information
- Spending insights

### 💳 Transactions
- Add transactions
- View transactions
- Search transactions
- Filter by category
- Filter by transaction status
- View transaction details
- Identify normal and anomalous transactions

### ⚠️ Anomaly Detection
ExpenseGuard uses **Z-score analysis** to identify transactions that significantly differ from the typical spending amount within a category.

A transaction can be considered anomalous when its absolute Z-score reaches the defined threshold.

### 👤 User Account
- Sign up
- Sign in
- Profile information
- Account management
- Logout functionality

### 🗂️ Categories
Expenses can be organized into categories such as:

- Food
- Transport
- Shopping
- Utilities
- Rent
- Mobile / Internet
- Entertainment
- Healthcare
- Education
- Other

---

## 🛠️ Technologies Used

- HTML5
- CSS3
- JavaScript
- LocalStorage
- Statistical analysis
- Z-score based anomaly detection

---

## 📂 Project Structure

```text
recurring-anomly-expense-detector/
│
├── css/
│   ├── anomalies.css
│   ├── auth.css
│   ├── style.css
│   ├── transaction.css
│   └── welcome.css
│
├── data/
│   └── sample-transactions.csv
│
├── javascript/
│   ├── anomalies.js
│   ├── app.js
│   ├── storage.js
│   └── transaction.js
│
├── pages/
│   ├── anomalies.html
│   ├── profile.html
│   ├── signin.html
│   ├── signup.html
│   ├── transactions.html
│   └── welcome.html
│
├── dashboard.html
├── index.html


🔍 How Anomaly Detection Works

ExpenseGuard uses the Z-score to measure how far a transaction amount is from the average transaction amount of its category.

Formula
Z = (X - μ) / σ

Where:

X = transaction amount
μ = mean transaction amount
σ = standard deviation

The absolute Z-score can then be used to determine whether a transaction is potentially unusual.

💾 Data Storage

The current application uses browser LocalStorage to store transaction and user-related information.

This allows the application to work without requiring a backend database for the current version.


