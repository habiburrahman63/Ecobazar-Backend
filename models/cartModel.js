const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      min: 1,
      required: true,
      default: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// High-frequency user cart indexes
cartSchema.index({ user: 1, product: 1 });
cartSchema.index({ user: 1 });

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
