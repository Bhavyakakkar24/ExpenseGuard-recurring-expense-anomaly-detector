# ExpenseGuard — Recurring Expense Anomaly Detector (CE-2)

ExpenseGuard is an intelligent, full-stack expense management and statistical anomaly detection application. Built for **Continuous Evaluation 2 (CE-2)**, this release upgrades the system from a client-only prototype to an enterprise-grade full-stack architecture featuring **real Google Authentication (Firebase Modular SDK)**, a persistent **MongoDB Atlas cloud database (Mongoose ODM)**, secure **Express.js REST APIs with Firebase Admin token verification**, and **real-time synchronization (Server-Sent Events)** across active browser sessions.

---

## 🏛️ System Architecture: CE-1 vs CE-2

| Layer | Continuous Evaluation 1 (CE-1) | Continuous Evaluation 2 (CE-2) |
| :--- | :--- | :--- |
| **Frontend UI** | Vanilla HTML, CSS, JavaScript | **Preserved:** Same dark navy aesthetic, layout, and components |
| **Authentication** | Simulated `localStorage` credentials | **Real Firebase Google Auth:** Popup sign-in via Modular Firebase v10 SDK |
| **Backend API** | None (Static files / Python server) | **Node.js & Express.js REST API:** JSON parsing, centralized error handling |
| **Token Verification** | None | **Firebase Admin SDK:** Verifies `Bearer <id_token>` on all protected routes |
| **Database** | Browser `localStorage` (ephemeral) | **MongoDB Atlas & Mongoose:** Persistent, indexed, schema-validated cloud storage |
| **Data Isolation** | Single-browser local isolation | **Multi-tenant isolation:** Every DB query scoped by verified `req.user.uid` |
| **Real-time Sync** | Manual page reload | **Server-Sent Events (SSE):** Instant updates across multiple open browser tabs |
| **Legacy Data** | Manual LocalStorage entries | **User-Initiated Migration:** Safe one-click import banner associating records to owner |
| **Testing** | Manual browser checks | **Automated Integration Tests:** 21 automated tests via Node test runner & Supertest |

---

## 🚀 Quick Start (Installation & Execution)

### 1. Prerequisites
- **Node.js** v18.0.0 or higher (`node -v`)
- **npm** v9.0.0 or higher
- A **MongoDB Atlas** cluster (or local MongoDB running on port 27017)
- A **Firebase Project** with Google Authentication enabled

### 2. Installation
Navigate to the project root and install all dependencies:
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to create your active `.env` file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Configure your environment variables in `.env`:
```env
PORT=5000
NODE_ENV=development

# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/expenseguard?retryWrites=true&w=majority

# Firebase Admin SDK (Option A: file path, Option B: inline JSON)
FIREBASE_SERVICE_ACCOUNT_PATH=./server/config/serviceAccountKey.json
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### 4. Running the Application
Start the unified backend server and frontend static server:
```bash
npm start
```
*(Or for development: `npm run dev`)*

The server will initialize:
```text
====================================================
🛡️  ExpenseGuard Server (CE-2) running on port 5000
🌐 Frontend: http://localhost:5000
🩺 Health:   http://localhost:5000/api/health
💳 APIs:     http://localhost:5000/api/transactions
====================================================
```

Open your browser to: **`http://localhost:5000`**

---

## 🔑 Firebase Google Authentication Setup

To enable real Google Sign-In with Firebase Authentication, perform the following steps in the [Firebase Console](https://console.firebase.google.com/):

### Step 1: Create or Select a Project
1. Open the Firebase Console and click **Add project**.
2. Enter a project name (e.g., `ExpenseGuard-CE2`) and click **Continue**.

### Step 2: Register a Web Application
1. In your Firebase Project Overview, click the **Web** icon (`</>`) to add an app.
2. Enter an App nickname (e.g., `ExpenseGuard Web`) and click **Register app**.
3. Firebase will display your Web App configuration snippet:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "expenseguard-ce2.firebaseapp.com",
     projectId: "expenseguard-ce2",
     storageBucket: "expenseguard-ce2.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
4. Open [javascript/firebase-auth.js](file:///javascript/firebase-auth.js) and replace the placeholder object in `firebaseConfig` with your actual keys.

### Step 3: Enable Google Sign-In Provider
1. In the left sidebar, navigate to **Build** → **Authentication**.
2. Click **Get Started** (if opening for the first time).
3. Under the **Sign-in method** tab, click **Google**.
4. Toggle **Enable**, select your project support email, and click **Save**.

### Step 4: Configure Authorized Domains
1. Under **Authentication** → **Settings** → **Authorized domains**, ensure the following domains are present:
   - `localhost`
   - `127.0.0.1`
   - Your production host domain (e.g. `expenseguard.vercel.app` if deploying online).

### Step 5: Generate Firebase Admin SDK Service Account (for Backend)
1. In the Firebase Console, click the **Settings gear** ⚙️ next to Project Overview → **Project settings**.
2. Navigate to the **Service accounts** tab.
3. Select **Node.js** and click **Generate new private key**.
4. Confirm by clicking **Generate key**. A `.json` credential file will be downloaded.
5. Save this file as:
   `server/config/serviceAccountKey.json`
   *(This path is strictly ignored by `.gitignore` so your secrets are never committed to version control).*

---

## 🍃 MongoDB Atlas Database Setup

### Step 1: Create a Free Shared Cluster
1. Log in to [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Click **Build a Database** and select the **M0 Free** shared cluster.
3. Choose your nearest cloud provider and region, then click **Create**.

### Step 2: Create a Database User
1. In the left sidebar under **Security**, click **Database Access**.
2. Click **Add New Database User**.
3. Set Authentication Method to **Password**.
4. Create a username (e.g., `expenseguard_user`) and a secure password.
5. Set Database User Privileges to **Read and write to any database**.
6. Click **Add User**.

### Step 3: Configure Network Access (IP Whitelist)
1. In the left sidebar under **Security**, click **Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access from Anywhere** (`0.0.0.0/0`) or enter your current IP.
4. Click **Confirm**.

### Step 4: Get Connection String
1. Under **Deployment**, click **Database**.
2. Click **Connect** on your cluster.
3. Choose **Drivers** (Node.js).
4. Copy the connection string format:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/expenseguard?retryWrites=true&w=majority
   ```
5. Paste this connection string into your `.env` file as `MONGODB_URI`, replacing `<username>` and `<password>` with your database user credentials.

---

## 📡 REST API Reference

All protected endpoints require the Firebase ID token in the `Authorization` header:
`Authorization: Bearer <FIREBASE_ID_TOKEN>`

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/health` | Service health, MongoDB state, Firebase status | No |
| `GET` | `/api/transactions` | List all transactions for authenticated user | **Yes** |
| `POST` | `/api/transactions` | Create a new transaction | **Yes** |
| `PUT` | `/api/transactions/:id` | Update an owned transaction | **Yes** |
| `DELETE` | `/api/transactions/:id` | Delete an owned transaction | **Yes** |
| `POST` | `/api/transactions/batch` | Bulk migrate/import transactions | **Yes** |
| `GET` | `/api/transactions/stream` | Real-time SSE transaction event stream | **Yes** |

### Example Request (Create Transaction)
```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_FIREBASE_ID_TOKEN>" \
  -d '{
    "date": "2026-10-22",
    "category": "Food",
    "description": "Team lunch at cafe",
    "amount": 750,
    "isRecurring": false,
    "paymentMethod": "UPI"
  }'
```

### Response Format
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "id": "6717a66b9f1d2e3b4c5d6e7f",
    "date": "2026-10-22",
    "category": "Food",
    "description": "Team lunch at cafe",
    "amount": 750,
    "isRecurring": false,
    "paymentMethod": "UPI",
    "tags": [],
    "anomalyMetadata": {
      "zScore": 0,
      "patternRatio": 1,
      "riskLevel": "Normal",
      "isAnomaly": false
    },
    "createdAt": "2026-10-22T12:00:00.000Z",
    "updatedAt": "2026-10-22T12:00:00.000Z"
  }
}
```

---

## ⚡ Real-Time Synchronization (Server-Sent Events)

ExpenseGuard includes real-time cross-tab and cross-device synchronization:
- Connects automatically via `GET /api/transactions/stream?token=<ID_TOKEN>`.
- Client registrations are strictly mapped to `req.user.uid`.
- When an expense is created, updated, or deleted, a JSON event is pushed **only** to the active sessions of that specific user.
- The frontend dynamically triggers dashboard re-calculations, anomaly risk reassessment, and category donut chart refreshes with zero manual page reload.
- Auto-reconnect and heartbeat keep-alive packets prevent connection drops through HTTP proxies.

---

## 🔍 Statistical Anomaly Detection Engine

ExpenseGuard preserves the CE-1 statistical anomaly detection model, now evaluated directly against database-backed transactions:

$$Z = \frac{X - \mu}{\sigma}$$

Where:
- $X$: Transaction amount
- $\mu$: Category mean spending: $\mu = \frac{\sum_{i=1}^{N}X_i}{N}$
- $\sigma$: Category standard deviation: $\sigma = \sqrt{\frac{\sum_{i=1}^{N}(X_i - \mu)^2}{N}}$

### Classification Criteria:
- **Normal:** $|Z| < 1.8$ (Expected distribution)
- **Medium Risk (Potential Anomaly):** $1.8 \le |Z| < 2.6$ or single-item fallback ratio $\ge 1.6 \times \text{mean}$
- **High Risk (Potential Anomaly):** $|Z| \ge 2.6$ or amount $\ge 3 \times \text{category mean}$

Flagged transactions display transparent explanations explaining why the expense diverges from typical category behavior.

---

## 🧪 Automated Testing

ExpenseGuard includes a comprehensive test suite written using Node's native test runner (`node:test`, `node:assert/strict`) and `supertest`.

To execute all tests:
```bash
npm test
```

### Verified Test Cases (21/21 Passing):
1. **Health Check:** `GET /api/health` returns status 200 with runtime and database status.
2. **Missing Token:** Protected routes return 401 when Authorization header is absent.
3. **Malformed Token:** Requests with invalid Bearer formatting return 401.
4. **Invalid Token:** Forged or expired Firebase tokens return 401.
5. **Stream Security:** SSE stream endpoint rejects unauthenticated connections with 401.
6. **Transaction Creation:** Valid payloads create records in MongoDB with verified UID ownership.
7. **Anti-Tampering:** Client-supplied `firebaseUid` in the request body is discarded; authoritative UID is enforced from the token.
8. **Amount Validation:** Rejects strings, zero, negative numbers, and non-numeric values (400).
9. **Date Validation:** Enforces strict YYYY-MM-DD calendar dates (400).
10. **Description Validation:** Rejects empty descriptions or strings exceeding 200 characters (400).
11. **Category Normalization:** Maps categories case-insensitively and falls back to "Other" for unlisted categories.
12. **User Data Isolation (Listing):** `GET /api/transactions` returns only the authenticated user's records.
13. **Transaction Update:** `PUT /api/transactions/:id` updates allowed fields and persists changes to MongoDB.
14. **Invalid ObjectId:** Malformed MongoDB IDs return 400 Bad Request.
15. **Update Non-Existent:** Returns 404 for records that do not exist.
16. **Cross-Tenant Security (Update):** User B attempting to update User A's transaction receives 404 and record is unmodified.
17. **Cross-Tenant Security (Delete):** User B attempting to delete User A's transaction receives 404 and record is preserved.
18. **Transaction Deletion:** `DELETE /api/transactions/:id` removes owned record from database (200).
19. **Delete Non-Existent:** Returns 404 when deleting already-deleted or non-existent record.
20. **Batch Migration:** `POST /api/transactions/batch` imports multiple transactions scoped to the user UID.
21. **Batch Validation:** Rejects non-array batch payloads with 400.

---

## 📁 Project Structure

```text
ExpenseGuard-recurring-expense-anomaly-detector-main/
│
├── server/                              # CE-2 Express Backend
│   ├── server.js                        # Express server entry point & middleware setup
│   ├── middleware/
│   │   └── verifyFirebaseToken.js       # Firebase Admin SDK ID token verification
│   ├── models/
│   │   └── Transaction.js               # Mongoose transaction schema & compound indexes
│   ├── routes/
│   │   └── transactions.js              # Secure CRUD, batch import, and SSE stream routes
│   └── utils/
│       └── realtime.js                  # SSE connection manager scoped by UID
│
├── tests/
│   └── api.test.js                      # 21 automated integration tests (Supertest + node:test)
│
├── javascript/                          # Frontend Logic
│   ├── firebase-auth.js                 # Firebase Modular SDK Google Auth helper
│   ├── api.js                           # API client with token injection & SSE subscription
│   ├── app.js                           # Core app logic, async DB loading, profile, CSV import
│   ├── transaction.js                   # Transaction management, async CRUD modal actions
│   ├── anomalies.js                     # Anomaly detector with database-backed calculations
│   ├── budgets.js                       # Budget limit tracking against database transactions
│   ├── categories.js                    # Category summaries and donut chart visualization
│   ├── settings.js                      # Settings panel, preferences, evaluation lab
│   └── reports.js                       # Financial reports and text export
│
├── pages/                               # Application Views
│   ├── welcome.html                     # Landing page
│   ├── signin.html                      # Sign In page (Google Auth button integrated)
│   ├── signup.html                      # Sign Up page (Google Auth button integrated)
│   ├── transactions.html                # Transactions data table & filter page
│   ├── anomalies.html                   # Anomaly center & risk monitor
│   ├── categories.html                  # Smart category analysis
│   ├── budgets.html                     # Monthly budget limits
│   ├── reports.html                     # Spending intelligence reports
│   ├── profile.html                     # User profile & database statistics
│   └── settings.html                    # Settings & Evaluation Lab
│
├── css/                                 # Styling (Preserved Dark Navy Theme)
│   ├── auth.css                         # Auth styling (Google button, divider, notices)
│   ├── evaluation.css                   # Core tokens, color palette, typography
│   └── style.css                        # Base layouts, navigation, and cards
│
├── dashboard.html                       # Main dashboard with one-click migration banner
├── index.html                           # Entry redirect
├── .env.example                         # Environment variables template
├── package.json                         # Node.js dependencies & test scripts
└── README.md                            # Comprehensive documentation
```

---

## 🔒 Security Best Practices Implemented

1. **Never Trust Client Identifiers:** The backend derives the owner UID solely from the cryptographically verified Firebase ID token via `admin.auth().verifyIdToken()`. Any `firebaseUid` or `userId` in the request body is ignored.
2. **Strict Query Scoping:** Every database query (`find`, `findOneAndUpdate`, `findOneAndDelete`) enforces `{ _id: id, firebaseUid: req.user.uid }`.
3. **No Mass Assignment:** Only approved fields (`amount`, `category`, `description`, `date`, `isRecurring`, `paymentMethod`, `tags`) can be created or updated.
4. **Input Sanitization & Validation:** Numbers are checked for finite positive values, dates conform to calendar format, and strings are length-limited.
5. **No Credentials in Source Control:** `.env` and `serviceAccountKey*.json` are excluded via `.gitignore`. Placeholders are clearly marked.
6. **Graceful Offline Fallback:** If cloud credentials are not yet configured, the system provides helpful UI banners and local database fallbacks without crashing.
