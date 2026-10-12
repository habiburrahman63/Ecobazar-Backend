const mongoose = require("mongoose");
const { Schema } = mongoose;
const slugify = require("slugify");

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    icon: {
      type: String,
      default: "Package",
    },
    subcategories: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

categorySchema.pre("save", function () {
  if (this.name && (this.isModified("name") || !this.slug)) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

// Database performance indexes for storefront category listings
categorySchema.index({ status: 1, createdAt: -1 });
categorySchema.index({ createdAt: -1 });

// Check if model is already registered to avoid overwrite errors
module.exports =
  mongoose.models.Category || mongoose.model("Category", categorySchema);
