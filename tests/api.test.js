// ============================================================
// EXPENSEGUARD — AUTOMATED API INTEGRATION TESTS (CE-2)
// Testing Express Endpoints, Firebase Token Verification,
// MongoDB CRUD, Multi-User Isolation, and Input Validation
// ============================================================

process.env.NODE_ENV = "test";
process.env.PORT = "5001";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../server/server");
const Transaction = require("../server/models/Transaction");

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/expenseguard_ce2_test";

// Test tokens supported by verifyFirebaseToken test bypass in development/test
const USER_ALICE_TOKEN = "Bearer test-token-user_alice_123";
const USER_BOB_TOKEN = "Bearer test-token-user_bob_456";
const INVALID_TOKEN = "Bearer invalid-or-expired-token";

describe("ExpenseGuard CE-2 API Test Suite", () => {
  before(async () => {
    // Connect to test database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }
  });

  after(async () => {
    // Clean up test database and close connection
    if (mongoose.connection.readyState === 1) {
      await Transaction.deleteMany({
        firebaseUid: { $in: ["user_alice_123", "user_bob_456"] },
      });
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clear transactions for the test users before each test
    if (mongoose.connection.readyState === 1) {
      await Transaction.deleteMany({
        firebaseUid: { $in: ["user_alice_123", "user_bob_456"] },
      });
    }
  });

  // ============================================================
  // 1. HEALTH CHECK ENDPOINT
  // ============================================================
  describe("GET /api/health", () => {
    test("should return 200 with status ok and application info", async () => {
      const res = await request(app).get("/api/health");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "ok");
      assert.equal(res.body.application, "ExpenseGuard API");
      assert.equal(res.body.version, "2.0.0");
      assert.ok(res.body.timestamp);
      assert.ok(res.body.database);
    });
  });

  // ============================================================
  // 2. AUTHENTICATION & SECURITY
  // ============================================================
  describe("Authentication & Authorization Middleware", () => {
    test("should return 401 when Authorization header is missing", async () => {
      const res = await request(app).get("/api/transactions");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Missing or malformed Authorization header/i);
    });

    test("should return 401 when Authorization header does not use Bearer format", async () => {
      const res = await request(app)
        .get("/api/transactions")
        .set("Authorization", "Basic user:pass");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Missing or malformed Authorization header/i);
    });

    test("should return 401 for invalid or unverified token", async () => {
      const res = await request(app)
        .get("/api/transactions")
        .set("Authorization", INVALID_TOKEN);
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test("should return 401 for SSE stream endpoint without token", async () => {
      const res = await request(app).get("/api/transactions/stream");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  // ============================================================
  // 3. CREATE TRANSACTION (POST /api/transactions)
  // ============================================================
  describe("POST /api/transactions", () => {
    test("should create a transaction with valid payload for authenticated user", async () => {
      const newTx = {
        date: "2026-10-22",
        category: "Food",
        description: "Dinner at Urban Bistro",
        amount: 850.5,
        isRecurring: false,
        paymentMethod: "UPI",
        tags: ["dining", "weekend"],
      };

      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send(newTx);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.equal(res.body.data.description, "Dinner at Urban Bistro");
      assert.equal(res.body.data.amount, 850.5);
      assert.equal(res.body.data.category, "Food");
      assert.equal(res.body.data.paymentMethod, "UPI");

      // Verify in database that owner is user_alice_123
      const saved = await Transaction.findById(res.body.data.id);
      assert.ok(saved);
      assert.equal(saved.firebaseUid, "user_alice_123");
    });

    test("should reject client-supplied firebaseUid and enforce verified token UID", async () => {
      const forgedTx = {
        firebaseUid: "victim_hacked_uid_999",
        date: "2026-10-22",
        category: "Shopping",
        description: "Unsanctioned charge",
        amount: 2500,
      };

      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send(forgedTx);

      assert.equal(res.status, 201);
      const saved = await Transaction.findById(res.body.data.id);
      // Must be alice, NEVER victim_hacked_uid_999
      assert.equal(saved.firebaseUid, "user_alice_123");
    });

    test("should reject missing or negative amounts", async () => {
      const invalidAmounts = [0, -500, "abc", null, undefined];
      for (const amount of invalidAmounts) {
        const res = await request(app)
          .post("/api/transactions")
          .set("Authorization", USER_ALICE_TOKEN)
          .send({
            date: "2026-10-22",
            category: "Food",
            description: "Test Invalid",
            amount,
          });
        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
      }
    });

    test("should reject missing or malformed date", async () => {
      const invalidDates = ["22-10-2026", "2026/10/22", "not-a-date", "", null];
      for (const date of invalidDates) {
        const res = await request(app)
          .post("/api/transactions")
          .set("Authorization", USER_ALICE_TOKEN)
          .send({
            date,
            category: "Food",
            description: "Invalid Date Test",
            amount: 150,
          });
        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
      }
    });

    test("should reject missing or empty description", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          date: "2026-10-22",
          category: "Food",
          description: "   ",
          amount: 200,
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test("should normalize category to 'Other' if unknown category passed", async () => {
      const res = await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          date: "2026-10-22",
          category: "CryptoMoonSpeculation",
          description: "Random coin purchase",
          amount: 1200,
        });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.category, "Other");
    });
  });

  // ============================================================
  // 4. READ TRANSACTIONS (GET /api/transactions)
  // ============================================================
  describe("GET /api/transactions", () => {
    test("should return only transactions owned by authenticated user", async () => {
      // Alice creates 2 transactions
      await Transaction.create([
        {
          firebaseUid: "user_alice_123",
          date: "2026-10-20",
          category: "Food",
          description: "Alice Grocery",
          amount: 1500,
        },
        {
          firebaseUid: "user_alice_123",
          date: "2026-10-21",
          category: "Transport",
          description: "Alice Metro Pass",
          amount: 400,
        },
      ]);

      // Bob creates 1 transaction
      await Transaction.create({
        firebaseUid: "user_bob_456",
        date: "2026-10-22",
        category: "Entertainment",
        description: "Bob Concert Ticket",
        amount: 3200,
      });

      // Alice fetches transactions
      const resAlice = await request(app)
        .get("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(resAlice.status, 200);
      assert.equal(resAlice.body.count, 2);
      assert.equal(resAlice.body.data.length, 2);
      resAlice.body.data.forEach((t) => {
        assert.notEqual(t.description, "Bob Concert Ticket");
      });

      // Bob fetches transactions
      const resBob = await request(app)
        .get("/api/transactions")
        .set("Authorization", USER_BOB_TOKEN);

      assert.equal(resBob.status, 200);
      assert.equal(resBob.body.count, 1);
      assert.equal(resBob.body.data[0].description, "Bob Concert Ticket");
    });
  });

  // ============================================================
  // 5. UPDATE TRANSACTION (PUT /api/transactions/:id)
  // ============================================================
  describe("PUT /api/transactions/:id", () => {
    test("should update an existing transaction owned by user", async () => {
      const created = await Transaction.create({
        firebaseUid: "user_alice_123",
        date: "2026-10-18",
        category: "Utilities",
        description: "Electricity Bill",
        amount: 1800,
      });

      const res = await request(app)
        .put(`/api/transactions/${created._id}`)
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          amount: 1950,
          description: "Electricity Bill (Revised)",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.amount, 1950);
      assert.equal(res.body.data.description, "Electricity Bill (Revised)");

      // Verify in DB
      const updated = await Transaction.findById(created._id);
      assert.equal(updated.amount, 1950);
      assert.equal(updated.description, "Electricity Bill (Revised)");
    });

    test("should reject updating with invalid ObjectId", async () => {
      const res = await request(app)
        .put("/api/transactions/invalid-mongo-id-123")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ amount: 500 });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Invalid transaction ID format/i);
    });

    test("should return 404 when updating non-existent transaction", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/transactions/${nonExistentId}`)
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ amount: 500 });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  // ============================================================
  // 6. MULTI-TENANT ISOLATION: USER A CANNOT UPDATE/DELETE USER B
  // ============================================================
  describe("Cross-User Isolation Security", () => {
    test("User Bob cannot update User Alice's transaction (returns 404)", async () => {
      const aliceTx = await Transaction.create({
        firebaseUid: "user_alice_123",
        date: "2026-10-15",
        category: "Rent",
        description: "Alice Apartment Rent",
        amount: 22000,
      });

      const res = await request(app)
        .put(`/api/transactions/${aliceTx._id}`)
        .set("Authorization", USER_BOB_TOKEN)
        .send({ amount: 100 });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);

      // Verify Alice's transaction was NOT altered
      const checkTx = await Transaction.findById(aliceTx._id);
      assert.equal(checkTx.amount, 22000);
    });

    test("User Bob cannot delete User Alice's transaction (returns 404)", async () => {
      const aliceTx = await Transaction.create({
        firebaseUid: "user_alice_123",
        date: "2026-10-15",
        category: "Subscriptions",
        description: "Alice Cloud Backup",
        amount: 799,
      });

      const res = await request(app)
        .delete(`/api/transactions/${aliceTx._id}`)
        .set("Authorization", USER_BOB_TOKEN);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);

      // Verify Alice's transaction still exists
      const checkTx = await Transaction.findById(aliceTx._id);
      assert.ok(checkTx);
    });
  });

  // ============================================================
  // 7. DELETE TRANSACTION (DELETE /api/transactions/:id)
  // ============================================================
  describe("DELETE /api/transactions/:id", () => {
    test("should delete an owned transaction successfully", async () => {
      const created = await Transaction.create({
        firebaseUid: "user_alice_123",
        date: "2026-10-19",
        category: "Food",
        description: "Coffee & Pastry",
        amount: 260,
      });

      const res = await request(app)
        .delete(`/api/transactions/${created._id}`)
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify removed from DB
      const checkTx = await Transaction.findById(created._id);
      assert.equal(checkTx, null);
    });

    test("should return 404 when deleting already deleted or non-existent record", async () => {
      const randomId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/transactions/${randomId}`)
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  // ============================================================
  // 8. BATCH IMPORT (POST /api/transactions/batch)
  // ============================================================
  describe("POST /api/transactions/batch", () => {
    test("should batch import multiple valid transactions for user", async () => {
      const batchPayload = [
        {
          date: "2026-10-01",
          category: "Groceries",
          description: "Monthly Supermarket Haul",
          amount: 4500,
        },
        {
          date: "2026-10-05",
          category: "Utilities",
          description: "Water Bill",
          amount: 350,
        },
        {
          date: "2026-10-10",
          category: "Entertainment",
          description: "Movie Night",
          amount: 600,
        },
      ];

      const res = await request(app)
        .post("/api/transactions/batch")
        .set("Authorization", USER_ALICE_TOKEN)
        .send(batchPayload);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 3);

      const inDb = await Transaction.find({ firebaseUid: "user_alice_123" });
      assert.equal(inDb.length, 3);
    });

    test("should reject non-array batch payloads", async () => {
      const res = await request(app)
        .post("/api/transactions/batch")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ invalid: "not an array" });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  // ============================================================
  // 9. ANOMALY DETECTION (GET /api/transactions/anomalies)
  // ============================================================
  describe("GET /api/transactions/anomalies", () => {
    test("should return empty list when no anomalies exist", async () => {
      // Normal transaction
      await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          date: "2026-10-01",
          category: "Food",
          description: "Normal Lunch",
          amount: 250,
        });

      const res = await request(app)
        .get("/api/transactions/anomalies")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.equal(res.body.count, 0);
    });

    test("should flag and return transactions satisfying anomaly criteria (high ratio or z-score)", async () => {
      // Baseline transactions
      await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          date: "2026-10-01",
          category: "Food",
          description: "Lunch 1",
          amount: 200,
        });

      await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          date: "2026-10-02",
          category: "Food",
          description: "Lunch 2",
          amount: 220,
        });

      // Spike transaction: 2500 in Food category (10x normal, R >= 3.0 and Z >= 2.6)
      await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          date: "2026-10-03",
          category: "Food",
          description: "Expensive Banquet",
          amount: 2500,
        });

      const res = await request(app)
        .get("/api/transactions/anomalies")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.count >= 1);
      const flagged = res.body.data.find((t) => t.description === "Expensive Banquet");
      assert.ok(flagged, "Expensive Banquet should be flagged as an anomaly");
      assert.equal(flagged.isAnomaly, true);
      assert.ok(flagged.anomalyMetadata);
      assert.ok(flagged.anomalyMetadata.patternRatio >= 1.6 || flagged.anomalyMetadata.zScore >= 1.8);
    });

    test("should isolate anomalies between users (Bob cannot see Alice's anomalies)", async () => {
      // Alice creates anomaly
      await request(app)
        .post("/api/transactions")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          date: "2026-10-01",
          category: "Shopping",
          description: "Alice Luxury Purchase",
          amount: 50000,
        });

      // Bob checks his anomalies
      const bobRes = await request(app)
        .get("/api/transactions/anomalies")
        .set("Authorization", USER_BOB_TOKEN);

      assert.equal(bobRes.status, 200);
      assert.equal(bobRes.body.count, 0);
    });
  });
});
