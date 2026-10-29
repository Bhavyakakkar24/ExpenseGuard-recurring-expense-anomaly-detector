const mongoose = require("mongoose");

const anomalySchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, "Owner UID is required"],
      index: true,
      trim: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: [true, "Transaction reference ID is required"],
      index: true,
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
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    date: {
      type: String,
      required: [true, "Transaction date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
      index: true,
    },
    anomalyType: {
      type: String,
      trim: true,
      default: "Statistical Outlier",
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "Low", "Medium", "High"],
      default: "medium",
      index: true,
    },
    detectionReason: {
      type: String,
      trim: true,
      default: "Expense deviates significantly from historical category spending patterns",
      maxlength: [500, "Detection reason cannot exceed 500 characters"],
    },
    score: {
      type: Number,
      default: 0, // Z-Score
    },
    patternRatio: {
      type: Number,
      default: 1, // Spending multiplier relative to mean
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "dismissed", "New", "Reviewed", "Dismissed"],
      default: "new",
      index: true,
    },
    detectedAt: {
      type: Date,
      default: Date.now,
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

// Compound unique index so one transaction cannot have duplicate anomaly records for the same user
anomalySchema.index({ firebaseUid: 1, transactionId: 1 }, { unique: true });
anomalySchema.index({ firebaseUid: 1, severity: 1 });
anomalySchema.index({ firebaseUid: 1, status: 1 });

const Anomaly = mongoose.model("Anomaly", anomalySchema);

module.exports = Anomaly;
