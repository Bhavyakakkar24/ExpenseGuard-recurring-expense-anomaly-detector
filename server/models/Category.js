const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, "Owner UID is required"],
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [60, "Category name cannot exceed 60 characters"],
    },
    icon: {
      type: String,
      trim: true,
      default: "✨",
      maxlength: [10, "Icon cannot exceed 10 characters"],
    },
    color: {
      type: String,
      trim: true,
      default: "#3f7ff4",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
      default: "",
    },
    monthlyLimit: {
      type: Number,
      min: [0, "Monthly limit cannot be negative"],
      default: 0,
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

// Compound unique index so one user cannot create duplicate categories with the same name
categorySchema.index({ firebaseUid: 1, name: 1 }, { unique: true });

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
