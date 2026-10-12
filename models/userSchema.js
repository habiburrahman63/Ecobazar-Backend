const mongoose = require("mongoose");
const { Schema } = mongoose;

<<<<<<< HEAD
const userSchema = new Schema(
  {
    name: {
=======
const userSchema = new Schema({
  name: {
    type: String,
  },

  email: {
    type: String,
  },
  password: {
    type: String,
  },
  phone: {
    type: String,
  },
  profile: {
    type: String,
  },
  isVeriFied: {
    type: Boolean,
    default: false,
  },
  roll: {
    type: String,
    enum: ["admin", "user", "editore", "vandore"],
    default: "user",
  },
  isHold: {
    type: Boolean,
    default: false,
  },
  postalCode: {
    type: String,
  },
  address: {
    type: String,
  },
  city: {
    type: String,
  },
  billingAddress: {
    fullName: {
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
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
<<<<<<< HEAD
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
=======

    street: {
      type: String,
    },

    zipCode: {
      type: String,
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
    },
    lastLogin: {
      type: Date,
    },
<<<<<<< HEAD
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
=======
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
  },
  { timestamps: true }
);

// High-performance user management and directory indexes
userSchema.index({ role: 1, isDelete: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
