const mongoose = require("mongoose");
const { Schema } = mongoose;
const slugify = require("slugify"); // ১. slugify ইমপোর্ট করুন
const { PRODUCT_SECTIONS, NO_SECTION } = require("../utils/productSections");

const productSchema = new Schema(
  {
    title: {
      type: String,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true, // sparse দিলে slug ফাঁকা থাকলেও এরর দিবে না
    },
    description: {
      type: String,
    },
    additionalInfo: {
      type: String,
    },
    price: {
      type: Number,
    },
    discountType: {
      type: String,
      enum: ["percent", "flat", "none"],
    },
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountStartDate: {
      type: Date,
    },
    discountEndtDate: {
      type: Date,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true, // sku-তেও sparse দিয়ে রাখা ভালো, না দিলে একই সমস্যা sku-র ক্ষেত্রেও হতে পারে
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
    },
    brand: {
      type: String,
    },
    shortDescription: {
      type: String,
    },
    category: {
      type: String,
    },
    // কোন storefront section-এ product টি দেখানো হবে (Today's Deals,
    // Featured Products, Best Sellers, New Arrivals)। কোনোটা না দিলে
    // empty string থাকে — তখন product টি কোনো section-এ restrict হয় না।
    section: {
      type: String,
      enum: [...PRODUCT_SECTIONS, NO_SECTION],
      default: NO_SECTION,
    },
    tag: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "pending",
    },
    images: [
      {
        url: {
          type: String,
        },
        isMain: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true },
);

// ৩. প্রোডাক্ট সেভ হওয়ার ঠিক আগে Title থেকে অটো Slug তৈরি করার হুক
productSchema.pre("save", async function () {
  if (this.title && (this.isModified("title") || !this.slug)) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
});

// ৪. Main Image integrity guard
// images অ্যারেতে সর্বোচ্চ একটি isMain:true থাকবেই। এটা নিশ্চিত করে যে create,
// update বা ভবিষ্যতের যেকোনো save path-এ একাধিক Main Image তৈরি হতে পারে না।
// আগে কোনো image-ই main না হলে প্রথম image-কে main করা হয়, যাতে
// "Main Image ছাড়া invalid product state" তৈরি না হয়।
productSchema.pre("validate", function () {
  if (Array.isArray(this.images) && this.images.length > 0) {
    const currentMainIndex = this.images.findIndex((img) => img && img.isMain);
    const mainIndex = currentMainIndex === -1 ? 0 : currentMainIndex;

    this.images.forEach((img, index) => {
      if (img) img.isMain = index === mainIndex;
    });
  }
});

// Database performance indexes for storefront & search queries
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ section: 1, createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);