const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, "Owner UID is required"],
      index: true,
      trim: true,
    },
    date: {
      type: String,
      required: [true, "Transaction date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
      index: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      enum: {
        values: [
          "Food",
          "Dining",
          "Groceries",
          "Transport",
          "Shopping",
          "Utilities",
          "Rent",
          "Mobile / Internet",
          "Entertainment",
          "Healthcare",
          "Education",
          "Subscriptions",
          "Other",
        ],
        message: "{VALUE} is not a valid predefined category",
      },
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be a positive number greater than 0"],
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: "Other",
    },
    tags: {
      type: [String],
      default: [],
    },
    anomalyMetadata: {
      zScore: { type: Number, default: 0 },
      patternRatio: { type: Number, default: 1 },
      riskLevel: {
        type: String,
        enum: ["Normal", "Medium", "High", "normal", "medium", "high"],
        default: "Normal",
      },
      isAnomaly: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for querying user transactions sorted by date
transactionSchema.index({ firebaseUid: 1, date: -1 });
transactionSchema.index({ firebaseUid: 1, category: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
