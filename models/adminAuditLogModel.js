const mongoose = require("mongoose");
const { Schema } = mongoose;

const adminAuditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    actorEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    actorName: {
      type: String,
      trim: true,
    },
    actorRole: {
      type: String,
      trim: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    targetEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    details: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "WARNING"],
      default: "SUCCESS",
    },
  },
  { timestamps: true }
);

// High-speed audit log timeline indexing
adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ actorId: 1, createdAt: -1 });

module.exports =
  mongoose.models.AdminAuditLog ||
  mongoose.model("AdminAuditLog", adminAuditLogSchema);

