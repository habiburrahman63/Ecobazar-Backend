const fs = require("fs");
const path = require("path");
const Product = require("../models/porductModel");

const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

/**
 * Ensures uploads directory exists.
 */
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.error("[ImageFileStorage] Failed to create uploads directory:", err.message);
  }
}

/**
 * Extracts clean filename from a URL, relative path, or filename string.
 * Example:
 *   "uploads/179...-file.jpg" -> "179...-file.jpg"
 *   "http://localhost:5000/uploads/179...-file.jpg" -> "179...-file.jpg"
 *   "179...-file.jpg" -> "179...-file.jpg"
 */
const extractFilename = (raw) => {
  if (!raw) return "";
  let str = "";
  if (typeof raw === "string") {
    str = raw.trim();
  } else if (raw && typeof raw.url === "string") {
    str = raw.url.trim();
  } else if (raw && typeof raw.filename === "string") {
    str = raw.filename.trim();
  }
  if (!str) return "";

  // Normalize slashes
  const normalized = str.replace(/\\/g, "/");
  const filename = normalized.split("/").pop();
  return filename && filename.trim() ? filename.trim() : "";
};

/**
 * Checks whether an image filename is still referenced by any other product in DB.
 * If excludeProductId is provided, ignores that product.
 */
const isImageInUse = async (filename, excludeProductId = null) => {
  if (!filename) return false;
  try {
    const filter = {
      "images.url": { $regex: filename, $options: "i" },
    };
    if (excludeProductId) {
      filter._id = { $ne: excludeProductId };
    }
    const count = await Product.countDocuments(filter);
    return count > 0;
  } catch (err) {
    console.error("[ImageFileStorage] Reference check error:", err.message);
    // Erring on the side of caution: don't delete if check failed
    return true;
  }
};

/**
 * Safely unlinks a file from the uploads directory.
 * Includes security checks against directory traversal.
 */
const unlinkUploadFile = async (filename) => {
  if (!filename) return false;
  try {
    // Resolve absolute path and prevent directory traversal
    const safePath = path.resolve(UPLOADS_DIR, filename);
    if (!safePath.startsWith(UPLOADS_DIR)) {
      console.warn(`[ImageFileStorage] Security block: Path traversal attempt prevented: ${filename}`);
      return false;
    }

    if (!fs.existsSync(safePath)) {
      return false;
    }

    await fs.promises.unlink(safePath);
    console.log(`[ImageFileStorage] Successfully deleted unused file: ${filename}`);
    return true;
  } catch (err) {
    console.error(`[ImageFileStorage] Failed to delete file ${filename}:`, err.message);
    return false;
  }
};

/**
 * Deletes a single image file from disk if it is not referenced elsewhere.
 */
const deleteImageFile = async (imageRef, excludeProductId = null) => {
  const filename = extractFilename(imageRef);
  if (!filename) return false;

  const inUse = await isImageInUse(filename, excludeProductId);
  if (inUse) {
    console.log(`[ImageFileStorage] Retaining image ${filename}: still referenced by another record.`);
    return false;
  }

  return await unlinkUploadFile(filename);
};

/**
 * Deletes multiple image files from disk if they are not in use elsewhere.
 */
const deleteMultipleImages = async (images = [], excludeProductId = null) => {
  if (!Array.isArray(images) || images.length === 0) return 0;
  let deletedCount = 0;
  for (const img of images) {
    const deleted = await deleteImageFile(img, excludeProductId);
    if (deleted) deletedCount++;
  }
  return deletedCount;
};

/**
 * Compares a product's old images against its new images and deletes any
 * images that were removed or replaced, provided they are not in use elsewhere.
 */
const cleanupRemovedProductImages = async ({
  oldImages = [],
  newImages = [],
  productId = null,
} = {}) => {
  if (!Array.isArray(oldImages) || oldImages.length === 0) return 0;

  const newFilenames = new Set(
    (Array.isArray(newImages) ? newImages : [])
      .map(extractFilename)
      .filter(Boolean)
  );

  const removedImages = oldImages.filter((oldImg) => {
    const fn = extractFilename(oldImg);
    return fn && !newFilenames.has(fn);
  });

  if (removedImages.length === 0) return 0;

  console.log(
    `[ImageFileStorage] Found ${removedImages.length} removed images from product ${productId || "unknown"}. Cleaning up...`
  );

  return await deleteMultipleImages(removedImages, productId);
};

/**
 * Immediately deletes newly uploaded files from disk if a request fails or is rejected.
 */
const cleanupMulterFiles = async (files = []) => {
  if (!Array.isArray(files) || files.length === 0) return 0;
  let deletedCount = 0;
  for (const file of files) {
    const filename = file.filename || extractFilename(file.path);
    if (filename) {
      const deleted = await unlinkUploadFile(filename);
      if (deleted) deletedCount++;
    }
  }
  return deletedCount;
};

/**
 * Comprehensive disk cleanup: scans the uploads directory and safely unlinks
 * all orphaned files that have zero references across the database.
 */
const cleanupAllOrphanedImages = async () => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return { totalFound: 0, deletedCount: 0, freedBytes: 0 };
    }

    const diskFiles = await fs.promises.readdir(UPLOADS_DIR);
    if (diskFiles.length === 0) {
      return { totalFound: 0, deletedCount: 0, freedBytes: 0 };
    }

    // Collect all active image filenames across all products
    const products = await Product.find({}, "images").lean();
    const activeFilenames = new Set();
    for (const p of products) {
      for (const img of p.images || []) {
        const fn = extractFilename(img);
        if (fn) activeFilenames.add(fn);
      }
    }

    let deletedCount = 0;
    let freedBytes = 0;

    for (const file of diskFiles) {
      if (!activeFilenames.has(file)) {
        const filePath = path.resolve(UPLOADS_DIR, file);
        try {
          const stat = await fs.promises.stat(filePath);
          if (stat.isFile()) {
            freedBytes += stat.size;
            await fs.promises.unlink(filePath);
            deletedCount++;
          }
        } catch (e) {
          console.error(`[ImageFileStorage] Failed to unlink orphan ${file}:`, e.message);
        }
      }
    }

    console.log(
      `[ImageFileStorage] Orphan Cleanup: Removed ${deletedCount} files, freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB.`
    );

    return {
      totalFound: diskFiles.length,
      deletedCount,
      freedBytes,
      remainingCount: diskFiles.length - deletedCount,
    };
  } catch (err) {
    console.error("[ImageFileStorage] Orphan sweep error:", err.message);
    throw err;
  }
};

/**
 * Optimizes newly uploaded files with sharp before saving references.
 */
const optimizeUploadedFiles = async (files = []) => {
  if (!Array.isArray(files) || files.length === 0) return;
  const sharp = require("sharp");
  for (const file of files) {
    try {
      const filePath = file.path || path.resolve(UPLOADS_DIR, file.filename);
      if (!fs.existsSync(filePath)) continue;
      const stats = await fs.promises.stat(filePath);
      if (stats.size > 250 * 1024) {
        const ext = path.extname(filePath).toLowerCase();
        const inputBuf = await fs.promises.readFile(filePath);
        let pipeline = sharp(inputBuf).rotate();
        if (ext === ".png") {
          pipeline = pipeline.png({ quality: 82, compressionLevel: 8 });
        } else if ([".jpg", ".jpeg"].includes(ext)) {
          pipeline = pipeline.jpeg({ quality: 80, progressive: true, mozjpeg: true });
        } else if (ext === ".webp") {
          pipeline = pipeline.webp({ quality: 80 });
        } else {
          continue;
        }
        const tmpPath = filePath + ".opt";
        await pipeline.toFile(tmpPath);
        const optStats = await fs.promises.stat(tmpPath);
        if (optStats.size < stats.size) {
          await fs.promises.unlink(filePath);
          await fs.promises.rename(tmpPath, filePath);
        } else {
          if (fs.existsSync(tmpPath)) await fs.promises.unlink(tmpPath);
        }
      }
    } catch (err) {
      console.warn("[ImageFileStorage] Optimization warning:", err.message);
    }
  }
};

module.exports = {
  extractFilename,
  isImageInUse,
  deleteImageFile,
  deleteMultipleImages,
  cleanupRemovedProductImages,
  cleanupMulterFiles,
  cleanupAllOrphanedImages,
  optimizeUploadedFiles,
};


