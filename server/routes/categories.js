const express = require("express");
const mongoose = require("mongoose");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const { verifyFirebaseToken } = require("../middleware/verifyFirebaseToken");
const { broadcastToUser } = require("../utils/realtime");

const router = express.Router();

// Protect all category routes with Firebase Authentication
router.use(verifyFirebaseToken);

// Predefined defaults for icons and theme colors
const DEFAULT_CATEGORY_METADATA = {
  Food: { icon: "🍜", color: "#f6a623" },
  Dining: { icon: "🍜", color: "#f6a623" },
  Groceries: { icon: "🛒", color: "#8fd14f" },
  Transport: { icon: "🚕", color: "#35b7ff" },
  Shopping: { icon: "🛍️", color: "#ef6b9b" },
  Utilities: { icon: "💡", color: "#32d9c1" },
  Rent: { icon: "🏠", color: "#3f7ff4" },
  "Mobile / Internet": { icon: "📱", color: "#32d9c1" },
  Entertainment: { icon: "🎬", color: "#9b7cff" },
  Healthcare: { icon: "💊", color: "#ef4444" },
  Education: { icon: "📚", color: "#8b5cf6" },
  Subscriptions: { icon: "💳", color: "#06b6d4" },
  Other: { icon: "✨", color: "#7c8ca5" },
};

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Validate category payload
 */
function validateCategoryPayload(body) {
  const errors = [];

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    errors.push("Category name is required");
  } else if (body.name.trim().length > 60) {
    errors.push("Category name cannot exceed 60 characters");
  }

  if (body.monthlyLimit !== undefined && body.monthlyLimit !== null && body.monthlyLimit !== "") {
    const limit = Number(body.monthlyLimit);
    if (isNaN(limit) || limit < 0 || !Number.isFinite(limit)) {
      errors.push("Monthly limit must be a non-negative number");
    }
  }

  if (body.description && typeof body.description === "string" && body.description.trim().length > 200) {
    errors.push("Description cannot exceed 200 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================
// GET /api/categories
// Fetch all saved categories for authenticated user
// ============================================================
router.get("/", async (req, res, next) => {
  try {
    const categories = await Category.find({ firebaseUid: req.user.uid })
      .sort({ name: 1 })
      .lean({ virtuals: true });

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories.map((c) => ({
        id: c._id ? c._id.toString() : c.id,
        name: c.name,
        icon: c.icon || "✨",
        color: c.color || "#3f7ff4",
        description: c.description || "",
        monthlyLimit: typeof c.monthlyLimit === "number" ? c.monthlyLimit : 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/categories
// Create a new category for authenticated user
// ============================================================
router.post("/", async (req, res, next) => {
  try {
    const validation = validateCategoryPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.errors,
      });
    }

    const trimmedName = req.body.name.trim();

    // Check for case-insensitive duplicate for the authenticated user
    const existing = await Category.findOne({
      firebaseUid: req.user.uid,
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Category '${trimmedName}' already exists`,
      });
    }

    const meta = DEFAULT_CATEGORY_METADATA[trimmedName] || {};
    const icon = req.body.icon ? String(req.body.icon).trim().slice(0, 10) : (meta.icon || "✨");
    const color = req.body.color ? String(req.body.color).trim() : (meta.color || "#3f7ff4");
    const description = req.body.description ? String(req.body.description).trim().slice(0, 200) : "";
    const monthlyLimit = req.body.monthlyLimit !== undefined && req.body.monthlyLimit !== ""
      ? Number(Number(req.body.monthlyLimit).toFixed(2))
      : 0;

    const categoryData = {
      firebaseUid: req.user.uid, // Authoritative owner from verified token
      name: trimmedName,
      icon,
      color,
      description,
      monthlyLimit,
    };

    const newCategory = await Category.create(categoryData);
    const jsonResult = newCategory.toJSON();

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "CATEGORY_CREATED",
      category: jsonResult,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: jsonResult,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Category with this name already exists",
      });
    }
    next(error);
  }
});

// ============================================================
// POST /api/categories/sync and POST /api/categories/init
// Idempotently initialize/sync categories from user's transactions
// ============================================================
async function handleInitOrSync(req, res, next) {
  try {
    // 1. Find all distinct categories present in user's transactions
    const distinctCategories = await Transaction.distinct("category", {
      firebaseUid: req.user.uid,
    });

    // 2. Fetch existing user categories
    const existingCategories = await Category.find({
      firebaseUid: req.user.uid,
    });
    const existingNamesLower = new Set(
      existingCategories.map((c) => c.name.toLowerCase().trim())
    );

    // Merge candidates: distinct transaction categories + baseline categories if totally empty
    const candidates = new Set(distinctCategories.map((c) => String(c).trim()).filter(Boolean));
    if (candidates.size === 0 && existingCategories.length === 0) {
      // Add standard starters if user has neither transactions nor categories
      [
        "Food",
        "Transport",
        "Shopping",
        "Utilities",
        "Rent",
        "Entertainment",
        "Healthcare",
        "Groceries",
        "Subscriptions",
        "Other",
      ].forEach((c) => candidates.add(c));
    }

    const created = [];
    for (const name of candidates) {
      if (!existingNamesLower.has(name.toLowerCase())) {
        const meta = DEFAULT_CATEGORY_METADATA[name] || {};
        const doc = await Category.create({
          firebaseUid: req.user.uid,
          name: name,
          icon: meta.icon || "✨",
          color: meta.color || "#3f7ff4",
          description: `Expenses related to ${name}`,
          monthlyLimit: 0,
        });
        existingNamesLower.add(name.toLowerCase());
        created.push(doc.toJSON());
      }
    }

    const allCategories = await Category.find({ firebaseUid: req.user.uid })
      .sort({ name: 1 })
      .lean({ virtuals: true });

    return res.status(200).json({
      success: true,
      message: `Synchronized categories (${created.length} new categories created)`,
      initializedCount: created.length,
      syncedCount: created.length,
      totalCount: allCategories.length,
      data: allCategories.map((c) => ({
        id: c._id ? c._id.toString() : c.id,
        name: c.name,
        icon: c.icon || "✨",
        color: c.color || "#3f7ff4",
        description: c.description || "",
        monthlyLimit: typeof c.monthlyLimit === "number" ? c.monthlyLimit : 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

router.post("/init", handleInitOrSync);
router.post("/sync", handleInitOrSync);

// ============================================================
// PUT /api/categories/:id
// Update an owned category
// ============================================================
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category ID format",
      });
    }

    const updates = {};
    if (req.body.name !== undefined) {
      const trimmedName = String(req.body.name).trim();
      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          error: "Category name cannot be empty",
        });
      }
      if (trimmedName.length > 60) {
        return res.status(400).json({
          success: false,
          error: "Category name cannot exceed 60 characters",
        });
      }

      // Check if another category already has this name for this user
      const duplicate = await Category.findOne({
        _id: { $ne: id },
        firebaseUid: req.user.uid,
        name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: `Category '${trimmedName}' already exists`,
        });
      }

      updates.name = trimmedName;
    }

    if (req.body.icon !== undefined) {
      updates.icon = String(req.body.icon).trim().slice(0, 10) || "✨";
    }

    if (req.body.color !== undefined) {
      updates.color = String(req.body.color).trim() || "#3f7ff4";
    }

    if (req.body.description !== undefined) {
      updates.description = String(req.body.description).trim().slice(0, 200);
    }

    if (req.body.monthlyLimit !== undefined && req.body.monthlyLimit !== null && req.body.monthlyLimit !== "") {
      const limit = Number(req.body.monthlyLimit);
      if (isNaN(limit) || limit < 0 || !Number.isFinite(limit)) {
        return res.status(400).json({
          success: false,
          error: "Monthly limit must be a non-negative number",
        });
      }
      updates.monthlyLimit = Number(limit.toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid update fields provided",
      });
    }

    const category = await Category.findOneAndUpdate(
      { _id: id, firebaseUid: req.user.uid },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found or you are not authorized to update it",
      });
    }

    const jsonResult = category.toJSON();

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "CATEGORY_UPDATED",
      category: jsonResult,
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: jsonResult,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Category with this name already exists",
      });
    }
    next(error);
  }
});

// ============================================================
// DELETE /api/categories/:id
// Safely delete an owned category (leaves transactions intact)
// ============================================================
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category ID format",
      });
    }

    const deleted = await Category.findOneAndDelete({
      _id: id,
      firebaseUid: req.user.uid,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Category not found or you are not authorized to delete it",
      });
    }

    // Broadcast SSE
    broadcastToUser(req.user.uid, {
      type: "CATEGORY_DELETED",
      id: id,
    });

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      id: id,
      deletedCategory: deleted.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
