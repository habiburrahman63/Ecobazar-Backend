const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        title: { type: String, required: true },
        price: { type: Number, required: true },
        sku: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        totalPrice: { type: Number, required: true },
        image: { type: String },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["aamarpay", "cod", "card", "bkash", "nagad"],
      default: "aamarpay",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "cancelled"],
      default: "unpaid",
    },
    shippingAddress: {
      fullName: String,
      phone: String,
      address: String,
      city: String,
      postalCode: String,
      notes: String,
    },
    tranid: {
      type: String,
      required: true,
      unique: true,
    },
    val_id: {
      type: String, // AamarPay pg_txnid
    },
    paymentDetails: {
      type: Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Database performance indexes for customer order history and admin analytics
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
