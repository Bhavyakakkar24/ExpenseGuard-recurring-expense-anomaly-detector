// ============================================================
// EXPENSEGUARD — ANOMALIES API TEST SUITE (CE-2)
// Testing Anomaly Detection, MongoDB Persistence, Idempotency,
// Review Status Updates, Safe Deletion, and Multi-User Isolation
// ============================================================

process.env.NODE_ENV = "test";
process.env.PORT = "5003";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../server/server");
const Anomaly = require("../server/models/Anomaly");
const Transaction = require("../server/models/Transaction");

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/expenseguard_ce2_test";

const USER_ALICE = "user_anom_alice_101";
const USER_BOB = "user_anom_bob_202";
const USER_ALICE_TOKEN = `Bearer test-token-${USER_ALICE}`;
const USER_BOB_TOKEN = `Bearer test-token-${USER_BOB}`;
const INVALID_TOKEN = "Bearer invalid-or-expired-token";

const TEST_UIDS = [USER_ALICE, USER_BOB];

describe("ExpenseGuard Anomalies API Test Suite", () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }
    await Anomaly.init();
    await Transaction.init();
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await Anomaly.deleteMany({ firebaseUid: { $in: TEST_UIDS } });
      await Transaction.deleteMany({ firebaseUid: { $in: TEST_UIDS } });
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await Anomaly.deleteMany({ firebaseUid: { $in: TEST_UIDS } });
      await Transaction.deleteMany({ firebaseUid: { $in: TEST_UIDS } });
    }
  });

  // ============================================================
  // 1. AUTHENTICATION & SECURITY
  // ============================================================
  describe("Anomaly Route Authentication", () => {
    test("should return 401 when Authorization header is missing", async () => {
      const res = await request(app).get("/api/anomalies");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Missing or malformed Authorization header/i);
    });

    test("should return 401 for invalid or unverified token", async () => {
      const res = await request(app)
        .get("/api/anomalies")
        .set("Authorization", INVALID_TOKEN);
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  // ============================================================
  // 2. DETECTION & PERSISTENCE (POST /api/anomalies/detect)
  // ============================================================
  describe("POST /api/anomalies/detect", () => {
    test("should detect statistical anomalies and persist them in MongoDB Atlas", async () => {
      // Create baseline normal transactions for Alice
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-01",
        category: "Food",
        description: "Lunch",
        amount: 200,
      });
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-02",
        category: "Food",
        description: "Dinner",
        amount: 250,
      });
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-03",
        category: "Food",
        description: "Snack",
        amount: 150,
      });
      // Create a massive spike (anomaly)
      const spikeTx = await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-04",
        category: "Food",
        description: "Luxury Banquet",
        amount: 5000,
      });

      const res = await request(app)
        .post("/api/anomalies/detect")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].amount, 5000);
      assert.equal(res.body.data[0].category, "Food");
      assert.equal(res.body.data[0].status, "new");
      assert.ok(res.body.data[0].detectionReason);
      assert.ok(res.body.data[0].patternRatio >= 3.0 || res.body.data[0].score > 1.5);

      // Verify actual document in MongoDB collection
      const savedDoc = await Anomaly.findOne({
        firebaseUid: USER_ALICE,
        transactionId: spikeTx._id,
      });
      assert.ok(savedDoc);
      assert.equal(savedDoc.amount, 5000);
      assert.equal(savedDoc.description, "Luxury Banquet");
      assert.equal(savedDoc.status, "new");
    });

    test("should run idempotently and avoid duplicate records on repeated calls", async () => {
      // Baseline + outlier
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-01",
        category: "Transport",
        description: "Bus ticket",
        amount: 50,
      });
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-02",
        category: "Transport",
        description: "Auto ride",
        amount: 60,
      });
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-03",
        category: "Transport",
        description: "Intercity Flight",
        amount: 8000,
      });

      // Call detect first time
      const res1 = await request(app)
        .post("/api/anomalies/detect")
        .set("Authorization", USER_ALICE_TOKEN);
      assert.equal(res1.status, 200);
      assert.equal(res1.body.count, 1);

      // Call detect second time
      const res2 = await request(app)
        .post("/api/anomalies/detect")
        .set("Authorization", USER_ALICE_TOKEN);
      assert.equal(res2.status, 200);
      assert.equal(res2.body.count, 1);

      // Ensure only 1 document in database
      const count = await Anomaly.countDocuments({ firebaseUid: USER_ALICE });
      assert.equal(count, 1);
    });

    test("should return 0 anomalies when spending is normal without fabricating records", async () => {
      // Perfectly normal transactions
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-01",
        category: "Groceries",
        description: "Milk & bread",
        amount: 100,
      });
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-02",
        category: "Groceries",
        description: "Vegetables",
        amount: 105,
      });
      await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-03",
        category: "Groceries",
        description: "Fruits",
        amount: 98,
      });

      const res = await request(app)
        .post("/api/anomalies/detect")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 0);
      assert.equal(res.body.data.length, 0);

      const dbCount = await Anomaly.countDocuments({ firebaseUid: USER_ALICE });
      assert.equal(dbCount, 0);
    });
  });

  // ============================================================
  // 3. RETRIEVAL & MULTI-USER ISOLATION (GET /api/anomalies)
  // ============================================================
  describe("GET /api/anomalies", () => {
    test("should return only authenticated user's anomalies (cross-user isolation)", async () => {
      const aliceTx = await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-10",
        category: "Shopping",
        description: "Alice Luxury Bag",
        amount: 9000,
      });
      const bobTx = await Transaction.create({
        firebaseUid: USER_BOB,
        date: "2026-10-11",
        category: "Shopping",
        description: "Bob Secret Watch",
        amount: 12000,
      });

      await Anomaly.create({
        firebaseUid: USER_ALICE,
        transactionId: aliceTx._id,
        description: "Alice Luxury Bag",
        amount: 9000,
        category: "Shopping",
        date: "2026-10-10",
        severity: "high",
        status: "new",
      });

      await Anomaly.create({
        firebaseUid: USER_BOB,
        transactionId: bobTx._id,
        description: "Bob Secret Watch",
        amount: 12000,
        category: "Shopping",
        date: "2026-10-11",
        severity: "high",
        status: "new",
      });

      const res = await request(app)
        .get("/api/anomalies")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].description, "Alice Luxury Bag");

      // Verify Bob cannot see Alice's anomaly
      const bobRes = await request(app)
        .get("/api/anomalies")
        .set("Authorization", USER_BOB_TOKEN);

      assert.equal(bobRes.status, 200);
      assert.equal(bobRes.body.count, 1);
      assert.equal(bobRes.body.data[0].description, "Bob Secret Watch");
    });
  });

  // ============================================================
  // 4. REVIEW STATUS UPDATES (PATCH /api/anomalies/:id)
  // ============================================================
  describe("PATCH /api/anomalies/:id", () => {
    test("should update review status to 'reviewed' in MongoDB Atlas", async () => {
      const tx = await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-12",
        category: "Entertainment",
        description: "VIP Concert Tickets",
        amount: 7000,
      });

      const anomaly = await Anomaly.create({
        firebaseUid: USER_ALICE,
        transactionId: tx._id,
        description: "VIP Concert Tickets",
        amount: 7000,
        category: "Entertainment",
        date: "2026-10-12",
        status: "new",
      });

      const res = await request(app)
        .patch(`/api/anomalies/${anomaly._id}`)
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ status: "reviewed" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, "reviewed");

      // Verify persistence in MongoDB Atlas
      const updated = await Anomaly.findById(anomaly._id);
      assert.equal(updated.status, "reviewed");
    });

    test("should reject invalid status values", async () => {
      const tx = await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-12",
        category: "Dining",
        description: "Steak",
        amount: 3000,
      });

      const anomaly = await Anomaly.create({
        firebaseUid: USER_ALICE,
        transactionId: tx._id,
        description: "Steak",
        amount: 3000,
        category: "Dining",
        date: "2026-10-12",
        status: "new",
      });

      const res = await request(app)
        .patch(`/api/anomalies/${anomaly._id}`)
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ status: "invalid_status_xyz" });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Invalid status/i);
    });

    test("should prevent Bob from updating Alice's anomaly (returns 404)", async () => {
      const tx = await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-13",
        category: "Utilities",
        description: "Gas Bill",
        amount: 4000,
      });

      const anomaly = await Anomaly.create({
        firebaseUid: USER_ALICE,
        transactionId: tx._id,
        description: "Gas Bill",
        amount: 4000,
        category: "Utilities",
        date: "2026-10-13",
        status: "new",
      });

      const res = await request(app)
        .patch(`/api/anomalies/${anomaly._id}`)
        .set("Authorization", USER_BOB_TOKEN)
        .send({ status: "reviewed" });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);

      const unchanged = await Anomaly.findById(anomaly._id);
      assert.equal(unchanged.status, "new");
    });
  });

  // ============================================================
  // 5. DISMISS / DELETE ANOMALY (DELETE /api/anomalies/:id)
  // ============================================================
  describe("DELETE /api/anomalies/:id", () => {
    test("should delete anomaly document from MongoDB without deleting the underlying transaction", async () => {
      const tx = await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-14",
        category: "Healthcare",
        description: "Dental Surgery",
        amount: 8500,
      });

      const anomaly = await Anomaly.create({
        firebaseUid: USER_ALICE,
        transactionId: tx._id,
        description: "Dental Surgery",
        amount: 8500,
        category: "Healthcare",
        date: "2026-10-14",
        status: "new",
      });

      const res = await request(app)
        .delete(`/api/anomalies/${anomaly._id}`)
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify anomaly record is deleted
      const foundAnomaly = await Anomaly.findById(anomaly._id);
      assert.equal(foundAnomaly, null);

      // CRITICAL: Verify transaction is preserved safely!
      const foundTx = await Transaction.findById(tx._id);
      assert.ok(foundTx);
      assert.equal(foundTx.amount, 8500);
      assert.equal(foundTx.description, "Dental Surgery");
    });

    test("should prevent Bob from deleting Alice's anomaly (returns 404)", async () => {
      const tx = await Transaction.create({
        firebaseUid: USER_ALICE,
        date: "2026-10-15",
        category: "Other",
        description: "Gold coin",
        amount: 25000,
      });

      const anomaly = await Anomaly.create({
        firebaseUid: USER_ALICE,
        transactionId: tx._id,
        description: "Gold coin",
        amount: 25000,
        category: "Other",
        date: "2026-10-15",
        status: "new",
      });

      const res = await request(app)
        .delete(`/api/anomalies/${anomaly._id}`)
        .set("Authorization", USER_BOB_TOKEN);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);

      const stillThere = await Anomaly.findById(anomaly._id);
      assert.ok(stillThere);
    });
  });
});
