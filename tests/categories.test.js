// ============================================================
// EXPENSEGUARD — CATEGORIES API TEST SUITE (CE-2)
// Testing Categories CRUD, Validation, Uniqueness, Authentication,
// Cross-User Isolation, and Idempotent Initialization
// ============================================================

process.env.NODE_ENV = "test";
process.env.PORT = "5002";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../server/server");
const Category = require("../server/models/Category");
const Transaction = require("../server/models/Transaction");

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/expenseguard_ce2_test";

const USER_ALICE_TOKEN = "Bearer test-token-user_cat_alice_789";
const USER_BOB_TOKEN = "Bearer test-token-user_cat_bob_987";
const INVALID_TOKEN = "Bearer invalid-or-expired-token";

const TEST_UIDS = ["user_cat_alice_789", "user_cat_bob_987"];

describe("ExpenseGuard Categories API Test Suite", () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }
    await Category.init();
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await Category.deleteMany({ firebaseUid: { $in: TEST_UIDS } });
      await Transaction.deleteMany({ firebaseUid: { $in: TEST_UIDS } });
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await Category.deleteMany({ firebaseUid: { $in: TEST_UIDS } });
      await Transaction.deleteMany({ firebaseUid: { $in: TEST_UIDS } });
    }
  });

  // ============================================================
  // 1. AUTHENTICATION & SECURITY
  // ============================================================
  describe("Category Route Authentication", () => {
    test("should return 401 when Authorization header is missing", async () => {
      const res = await request(app).get("/api/categories");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Missing or malformed Authorization header/i);
    });

    test("should return 401 for invalid or unverified token", async () => {
      const res = await request(app)
        .get("/api/categories")
        .set("Authorization", INVALID_TOKEN);
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  // ============================================================
  // 2. CREATE CATEGORY (POST /api/categories)
  // ============================================================
  describe("POST /api/categories", () => {
    test("should create a category with valid payload for authenticated user", async () => {
      const payload = {
        name: "Fitness",
        icon: "🏋️",
        color: "#10b981",
        monthlyLimit: 5000,
        description: "Gym, supplements, and sports gear",
      };

      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", USER_ALICE_TOKEN)
        .send(payload);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, "Fitness");
      assert.equal(res.body.data.icon, "🏋️");
      assert.equal(res.body.data.color, "#10b981");
      assert.equal(res.body.data.monthlyLimit, 5000);
      assert.equal(res.body.data.description, "Gym, supplements, and sports gear");
      assert.ok(res.body.data.id);
      assert.ok(res.body.data.createdAt);

      // Verify in database
      const saved = await Category.findOne({
        _id: res.body.data.id,
        firebaseUid: "user_cat_alice_789",
      });
      assert.ok(saved);
      assert.equal(saved.name, "Fitness");
    });

    test("should reject client-supplied firebaseUid and enforce verified token UID", async () => {
      const payload = {
        name: "Travel",
        firebaseUid: "hacker_attacker_999",
      };

      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", USER_ALICE_TOKEN)
        .send(payload);

      assert.equal(res.status, 201);
      const saved = await Category.findById(res.body.data.id);
      assert.equal(saved.firebaseUid, "user_cat_alice_789");
    });

    test("should reject empty or missing category name", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ name: "   " });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test("should reject negative monthly limit", async () => {
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ name: "Gaming", monthlyLimit: -500 });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test("should reject duplicate category name for the same user", async () => {
      await Category.create({
        firebaseUid: "user_cat_alice_789",
        name: "Groceries",
      });

      // Try creating duplicate with different casing/spacing
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ name: "  groceries  " });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /already exists/i);
    });

    test("should allow two different users to create a category with the same name", async () => {
      const aliceRes = await request(app)
        .post("/api/categories")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ name: "Investments" });
      assert.equal(aliceRes.status, 201);

      const bobRes = await request(app)
        .post("/api/categories")
        .set("Authorization", USER_BOB_TOKEN)
        .send({ name: "Investments" });
      assert.equal(bobRes.status, 201);
      assert.notEqual(aliceRes.body.data.id, bobRes.body.data.id);
    });
  });

  // ============================================================
  // 3. GET CATEGORIES (GET /api/categories)
  // ============================================================
  describe("GET /api/categories", () => {
    test("should return only categories owned by authenticated user", async () => {
      await Category.create({ firebaseUid: "user_cat_alice_789", name: "Alice Cat 1" });
      await Category.create({ firebaseUid: "user_cat_alice_789", name: "Alice Cat 2" });
      await Category.create({ firebaseUid: "user_cat_bob_987", name: "Bob Secret Cat" });

      const res = await request(app)
        .get("/api/categories")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2);
      const names = res.body.data.map((c) => c.name);
      assert.ok(names.includes("Alice Cat 1"));
      assert.ok(names.includes("Alice Cat 2"));
      assert.ok(!names.includes("Bob Secret Cat"));
    });
  });

  // ============================================================
  // 4. UPDATE CATEGORY (PUT /api/categories/:id)
  // ============================================================
  describe("PUT /api/categories/:id", () => {
    test("should update an owned category successfully", async () => {
      const cat = await Category.create({
        firebaseUid: "user_cat_alice_789",
        name: "Old Name",
        monthlyLimit: 1000,
      });

      const res = await request(app)
        .put(`/api/categories/${cat._id}`)
        .set("Authorization", USER_ALICE_TOKEN)
        .send({
          name: "New Name",
          icon: "🚀",
          monthlyLimit: 2500,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, "New Name");
      assert.equal(res.body.data.icon, "🚀");
      assert.equal(res.body.data.monthlyLimit, 2500);
    });

    test("should reject renaming to another existing category of the same user", async () => {
      const cat1 = await Category.create({ firebaseUid: "user_cat_alice_789", name: "Dining" });
      const cat2 = await Category.create({ firebaseUid: "user_cat_alice_789", name: "Food" });

      const res = await request(app)
        .put(`/api/categories/${cat2._id}`)
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ name: "dining" });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /already exists/i);
    });

    test("should reject updating category with invalid ObjectId", async () => {
      const res = await request(app)
        .put("/api/categories/invalid-object-id")
        .set("Authorization", USER_ALICE_TOKEN)
        .send({ name: "Whatever" });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Invalid category ID format/i);
    });

    test("should prevent Bob from updating Alice's category (returns 404)", async () => {
      const aliceCat = await Category.create({
        firebaseUid: "user_cat_alice_789",
        name: "Alice Private Category",
      });

      const res = await request(app)
        .put(`/api/categories/${aliceCat._id}`)
        .set("Authorization", USER_BOB_TOKEN)
        .send({ name: "Hacked by Bob" });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);

      const unchanged = await Category.findById(aliceCat._id);
      assert.equal(unchanged.name, "Alice Private Category");
    });
  });

  // ============================================================
  // 5. DELETE CATEGORY (DELETE /api/categories/:id)
  // ============================================================
  describe("DELETE /api/categories/:id", () => {
    test("should delete an owned category without deleting its transactions", async () => {
      const cat = await Category.create({
        firebaseUid: "user_cat_alice_789",
        name: "Shopping",
      });

      // Create transactions under Shopping
      const tx = await Transaction.create({
        firebaseUid: "user_cat_alice_789",
        date: "2026-10-20",
        category: "Shopping",
        description: "New Shoes",
        amount: 2500,
      });

      const res = await request(app)
        .delete(`/api/categories/${cat._id}`)
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify category document is removed from MongoDB Atlas
      const foundCat = await Category.findById(cat._id);
      assert.equal(foundCat, null);

      // CRITICAL: Verify transaction is preserved safely!
      const foundTx = await Transaction.findById(tx._id);
      assert.ok(foundTx);
      assert.equal(foundTx.amount, 2500);
      assert.equal(foundTx.category, "Shopping");
    });

    test("should prevent Bob from deleting Alice's category (returns 404)", async () => {
      const aliceCat = await Category.create({
        firebaseUid: "user_cat_alice_789",
        name: "Alice Important Cat",
      });

      const res = await request(app)
        .delete(`/api/categories/${aliceCat._id}`)
        .set("Authorization", USER_BOB_TOKEN);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);

      const stillThere = await Category.findById(aliceCat._id);
      assert.ok(stillThere);
    });
  });

  // ============================================================
  // 6. INITIALIZATION & MIGRATION (POST /api/categories/init)
  // ============================================================
  describe("POST /api/categories/init", () => {
    test("should safely initialize missing category documents from transactions idempotently", async () => {
      // Create user transactions with distinct categories
      await Transaction.create({
        firebaseUid: "user_cat_alice_789",
        date: "2026-10-21",
        category: "Dining",
        description: "Pizza dinner",
        amount: 800,
      });
      await Transaction.create({
        firebaseUid: "user_cat_alice_789",
        date: "2026-10-22",
        category: "Transport",
        description: "Metro card",
        amount: 500,
      });
      // Bob transaction should NOT be touched or imported
      await Transaction.create({
        firebaseUid: "user_cat_bob_987",
        date: "2026-10-22",
        category: "Entertainment",
        description: "Movie tickets",
        amount: 600,
      });

      // Call init first time
      const res1 = await request(app)
        .post("/api/categories/init")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res1.status, 200);
      assert.equal(res1.body.success, true);
      assert.equal(res1.body.initializedCount, 2);

      const aliceCats = await Category.find({ firebaseUid: "user_cat_alice_789" });
      const aliceCatNames = aliceCats.map((c) => c.name);
      assert.ok(aliceCatNames.includes("Dining"));
      assert.ok(aliceCatNames.includes("Transport"));
      assert.ok(!aliceCatNames.includes("Entertainment")); // Bob's category not imported!

      // Call init a second time (IDEMPOTENCY TEST)
      const res2 = await request(app)
        .post("/api/categories/init")
        .set("Authorization", USER_ALICE_TOKEN);

      assert.equal(res2.status, 200);
      assert.equal(res2.body.initializedCount, 0); // No duplicates created!

      const aliceCatsAfter = await Category.find({ firebaseUid: "user_cat_alice_789" });
      assert.equal(aliceCatsAfter.length, 2);
    });
  });
});
