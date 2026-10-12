const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    profile: {
      type: String,
    },
    isVeriFied: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["admin", "user", "manager", "editor", "editore", "vendor", "vandore"],
      default: "user",
    },
    isHold: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    postalCode: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    isDelete: {
      type: Boolean,
      default: false,
    },
    billingAddress: {
      fullName: { type: String },
      email: { type: String },
      street: { type: String },
      zipCode: { type: String },
      phoneNumber: { type: String },
    },
  },
  { timestamps: true }
);

// High-performance user management and directory indexes
userSchema.index({ role: 1, isDelete: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
