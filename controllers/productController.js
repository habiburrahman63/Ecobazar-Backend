const Product = require("../models/porductModel");
const Cat = require("../models/productCatgoryModel");
const {
  normalizeSection,
  isValidSection,
} = require("../utils/productSections");
const {
  buildImagesFromUploads,
  mergeProductImages,
  getMainImageUrl,
  normalizeImageUrl,
} = require("../utils/productImageUtils");
const {
  deleteImageFile,
  deleteMultipleImages,
  cleanupRemovedProductImages,
  cleanupMulterFiles,
  cleanupAllOrphanedImages,
  optimizeUploadedFiles,
} = require("../utils/imageFileStorage");
const slugify = require("slugify");

/**
 * Normalizes product images to ensure a consistent isMain flag and absolute/clean URL structure.
 */
const withSafeImages = (product) => {
  if (!product) return product;
  const doc = product.toObject ? product.toObject() : { ...product };
  if (!Array.isArray(doc.images) || doc.images.length === 0) {
    return doc;
  }
  const mainUrl = getMainImageUrl(doc.images);
  doc.images = doc.images.map((img) => {
    const url = normalizeImageUrl(img && img.url);
    return {
      ...(img && img._id ? { _id: img._id } : {}),
      url,
      isMain: url === mainUrl,
    };
  });
  return doc;
};

// ==========================================
// CATEGORY CONTROLLERS (Full CRUD)
// ==========================================

const getCategory = async (req, res) => {
  try {
    const categories = await Cat.find({}).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
      error: error.message,
    });
  }
};

const productCatgory = async (req, res) => {
  try {
    const { name, icon, subcategories, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const trimmedName = name.trim();
    const existing = await Cat.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Category "${trimmedName}" already exists`,
      });
    }

    let parsedSubs = [];
    if (Array.isArray(subcategories)) {
      parsedSubs = subcategories.map((s) => s.trim()).filter(Boolean);
    } else if (typeof subcategories === "string") {
      parsedSubs = subcategories
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const category = new Cat({
      name: trimmedName,
      icon: icon && icon.trim() ? icon.trim() : "Package",
      subcategories: parsedSubs,
      status: status || "active",
      slug: slugify(trimmedName, { lower: true, strict: true }),
    });

    await category.save();

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, subcategories, status } = req.body;

    const category = await Cat.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (name && name.trim()) {
      const trimmedName = name.trim();
      const existing = await Cat.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Another category named "${trimmedName}" already exists`,
        });
      }
      category.name = trimmedName;
      category.slug = slugify(trimmedName, { lower: true, strict: true });
    }

    if (icon !== undefined) category.icon = icon;
    if (status !== undefined) category.status = status;

    if (subcategories !== undefined) {
      if (Array.isArray(subcategories)) {
        category.subcategories = subcategories.map((s) => s.trim()).filter(Boolean);
      } else if (typeof subcategories === "string") {
        category.subcategories = subcategories
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Cat.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};

// ==========================================
// PRODUCT CONTROLLERS (Full CRUD)
// ==========================================

const createProductControleer = async (req, res) => {
  try {
    const {
      title,
      price,
      category,
      tag,
      stock,
      discountType,
      discount,
      discountStartDate,
      discountEndtDate,
      isMain,
      mainImage,
    } = req.body;

    if (!title || !title.trim()) {
      await cleanupMulterFiles(req.files);
      return res.status(400).json({
        success: false,
        message: "Product title is required",
      });
    }

    if (req.body.section !== undefined && !isValidSection(req.body.section)) {
      await cleanupMulterFiles(req.files);
      return res.status(400).json({
        success: false,
        message: "Invalid section specified",
      });
    }
    const section = normalizeSection(req.body.section);

    const existingProduct = await Product.findOne({ title: title.trim() });
    if (existingProduct) {
      await cleanupMulterFiles(req.files);
      return res.status(409).json({
        success: false,
        message: "A product with this title already exists",
      });
    }

    await optimizeUploadedFiles(req.files);

    let images;
    try {
      images = buildImagesFromUploads(req.files, mainImage, isMain).images;
    } catch (imageError) {
      await cleanupMulterFiles(req.files);
      return res.status(400).json({
        success: false,
        message: imageError.message,
      });
    }

    const sku = `${Date.now()}-${new Date().getFullYear()}`;

    if (stock === undefined || Number(stock) < 0) {
      await cleanupMulterFiles(req.files);
      return res.status(400).json({
        success: false,
        message: "Stock quantity must be 0 or greater",
      });
    }

    const {
      isMain: _isMain,
      mainImage: _mainImage,
      photos: _photos,
      keepImages: _keep,
      section: _section,
      ...productFields
    } = req.body;

    const product = new Product({
      ...productFields,
      title: title.trim(),
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      category: category || "",
      section: section,
      tag: (tag || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      images: images,
      sku: sku,
    });

    await product.save();
    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: withSafeImages(product),
    });
  } catch (error) {
    await cleanupMulterFiles(req.files);
    console.error("Create product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
};

const getProductControleer = async (req, res) => {
  try {
    const { category, section, status, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }
    if (category) {
      filter.category = category;
    }
    if (section) {
      filter.section = section;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      product: products.map(withSafeImages),
    });
  } catch (error) {
    console.error("Get products error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error fetching products",
      error: error.message,
    });
  }
};

const getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let singleProduct;

    // Check if ID is a valid ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      singleProduct = await Product.findById(id).lean();
    }
    if (!singleProduct) {
      singleProduct = await Product.findOne({ slug: id }).lean();
    }

    if (!singleProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      singleProduct: withSafeImages(singleProduct),
    });
  } catch (error) {
    console.error("Get single product error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error fetching single product",
      error: error.message,
    });
  }
};

const productDeleteControleer = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const imagesToClean = [...(product.images || [])];
    await Product.findByIdAndDelete(id);

    // Synchronously clean up all associated image files from disk
    await deleteMultipleImages(imagesToClean, id);

    return res.status(200).json({
      success: true,
      message: "Product and associated images deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error deleting product",
      error: error.message,
    });
  }
};

const UPDATABLE_FIELDS = [
  "title",
  "sku",
  "shortDescription",
  "description",
  "additionalInfo",
  "price",
  "stock",
  "category",
  "brand",
  "status",
  "discountType",
  "discount",
  "discountStartDate",
  "discountEndtDate",
];

const productUpdateControleer = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const product = await Product.findById(id);
    if (!product) {
      await cleanupMulterFiles(req.files);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    UPDATABLE_FIELDS.forEach((field) => {
      if (body[field] !== undefined) product.set(field, body[field]);
    });

    if (body.section !== undefined) {
      if (!isValidSection(body.section)) {
        await cleanupMulterFiles(req.files);
        return res.status(400).json({
          success: false,
          message: "Invalid section",
        });
      }
      product.set("section", normalizeSection(body.section));
    }

    if (body.tag !== undefined) {
      product.set(
        "tag",
        (body.tag || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }

    let mainRef = body.mainImage;
    if (
      (mainRef === undefined || mainRef === "") &&
      body.isMain !== undefined &&
      body.isMain !== "" &&
      Array.isArray(req.files) &&
      req.files.length > 0
    ) {
      mainRef = `new:${Number(body.isMain)}`;
    }

    const oldImages = [...(product.images || [])];

    if (Array.isArray(req.files) && req.files.length > 0) {
      await optimizeUploadedFiles(req.files);
    }

    const imageResult = mergeProductImages({
      currentImages: product.images,
      keepImages: body.keepImages,
      mainRef,
      newFiles: req.files,
    });

    if (imageResult.changed) {
      product.set("images", imageResult.images);
    }

    await product.save();

    // If images changed, safely clean up files that were removed or replaced
    if (imageResult.changed) {
      await cleanupRemovedProductImages({
        oldImages,
        newImages: imageResult.images,
        productId: product._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      Product: withSafeImages(product),
    });
  } catch (error) {
    await cleanupMulterFiles(req.files);
    console.error("Update product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server Error updating product",
    });
  }
};

/**
 * Remove a specific image from a product with instant DB & disk file synchronization
 */
const deleteProductImageController = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Image URL is required",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const targetUrl = normalizeImageUrl(imageUrl);
    const initialCount = product.images.length;
    const filteredImages = product.images.filter(
      (img) => normalizeImageUrl(img && img.url) !== targetUrl
    );

    if (filteredImages.length === initialCount) {
      return res.status(404).json({
        success: false,
        message: "Image not found on this product",
      });
    }

    if (filteredImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "A product must have at least one image. Cannot remove all images.",
      });
    }

    // Ensure there is still a main image
    if (!filteredImages.some((img) => img.isMain)) {
      filteredImages[0].isMain = true;
    }

    product.images = filteredImages;
    await product.save();

    // Safely delete file from disk if not referenced by another product
    await deleteImageFile(targetUrl, product._id);

    return res.status(200).json({
      success: true,
      message: "Image removed from product and disk successfully",
      product: withSafeImages(product),
    });
  } catch (error) {
    console.error("Delete product image error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete product image",
      error: error.message,
    });
  }
};

/**
 * Clean up all orphaned images on disk that have 0 references across the database
 */
const cleanupOrphanedImagesController = async (req, res) => {
  try {
    const result = await cleanupAllOrphanedImages();
    return res.status(200).json({
      success: true,
      message: `Orphaned image cleanup complete. Removed ${result.deletedCount} files, freed ${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB.`,
      result,
    });
  } catch (error) {
    console.error("Cleanup orphaned images error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cleanup orphaned images",
      error: error.message,
    });
  }
};

module.exports = {
  getCategory,
  productCatgory,
  updateCategory,
  deleteCategory,
  createProductControleer,
  getProductControleer,
  getSingleProduct,
  productDeleteControleer,
  productUpdateControleer,
  deleteProductImageController,
  cleanupOrphanedImagesController,
};
