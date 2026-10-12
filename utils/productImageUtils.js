/**
 * Product Image + Main Image management logic (shared by create & update).
 *
 * Frontend -> backend image contract (multipart/form-data):
 *   photos     : নতুন upload করা ফাইলগুলো (multer req.files)
 *   keepImages : JSON string -> existing product-এর যে image গুলো রাখতে চাই (ordered)
 *   mainImage  : Main image reference ->
 *                  "new:2"         => নতুন upload করা ২য় (0-based) ফাইলটি
 *                  "uploads/a.png" => existing image-এর url
 *
 * Rules (প্রতিটি create/update path একইভাবে apply হয়):
 *   1. সর্বোচ্চ ৫টি image রাখা যাবে।
 *   2. duplicate url কখনোই images array-তে থাকবে না।
 *   3. অজানা/ভুল image reference (যা product-এ নেই) save হবে না।
 *   4. images থাকলে ঠিক একটি isMain:true থাকবেই; কোনোটিই main না হলে প্রথমটি main হবে।
 *   5. existing image শুধু main বদলালে delete/modify হবে না — শুধু isMain ফ্ল্যাগ বদলায়।
 */

const MAX_IMAGES = 5;
const NEW_FILE_PREFIX = "new:";

/**
 * Windows এ multer item.path = "uploads\file.png" হয়, যা URL এ কাজ করে না।
 * এছাড়াও legacy document-এ backslash আছে — সবসময় forward slash এ normalize করা হয়।
 */
const normalizeImageUrl = (raw) => {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let url = trimmed.replace(/\\/g, "/");

  // If absolute URL (e.g. http://localhost:5000/uploads/file.png), strip origin
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      url = parsed.pathname.replace(/^\/+/, "");
    } catch {
      url = url.replace(/^https?:\/\/[^\/]+\/?/i, "");
    }
  }

  // relative path ("uploads//a.png" বা "./uploads/a.png") হলে duplicate slash ঠিক করা হয়
  url = url.replace(/\/{2,}/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  return url;
};

/** multer file object -> normalized url string */
const fileToUrl = (file) => {
  if (!file) return "";
  if (typeof file === "string") return normalizeImageUrl(file);
  return normalizeImageUrl(file.path || file.filename || "");
};

/**
 * reference ("new:2" অথবা url) থেকে main image-এর url বের করে।
 * reference অনুপস্থিত/অবৈধ হলে null।
 */
const resolveMainReference = (ref, uploadedUrls, finalUrlSet) => {
  if (typeof ref !== "string" || ref.trim() === "") return null;
  const value = ref.trim();

  if (value.startsWith(NEW_FILE_PREFIX)) {
    const index = Number(value.slice(NEW_FILE_PREFIX.length));
    if (!Number.isInteger(index) || index < 0) return null;
    const url = uploadedUrls[index];
    return url && finalUrlSet.has(url) ? url : null;
  }

  const url = normalizeImageUrl(value);
  return finalUrlSet.has(url) ? url : null;
};

/**
 * নতুন product এর image list তৈরি করে (শুধু নতুন upload থাকলে — create এর জন্য)।
 * legacyMainIndex: পুরোনো frontend যা isMain index পাঠাত — backward compatibility।
 */
const buildImagesFromUploads = (newFiles, mainRef, legacyMainIndex) => {
  const uploadedUrls = (Array.isArray(newFiles) ? newFiles : [])
    .map(fileToUrl)
    .filter(Boolean);

  if (uploadedUrls.length === 0) {
    throw new Error("At least one product image is required");
  }
  if (uploadedUrls.length > MAX_IMAGES) {
    throw new Error(`A product can have at most ${MAX_IMAGES} images`);
  }

  const deduped = [...new Set(uploadedUrls)];
  const finalUrlSet = new Set(deduped);

  let mainUrl = resolveMainReference(mainRef, uploadedUrls, finalUrlSet);

  if (!mainUrl && legacyMainIndex !== undefined && legacyMainIndex !== "") {
    const index = Number(legacyMainIndex);
    if (Number.isInteger(index) && deduped[index]) mainUrl = deduped[index];
  }

  // কোনো সঠিক reference না থাকলে => প্রথম image স্বয়ংক্রিয়ভাবে Main Image
  // (এতে "Main Image ছাড়া invalid product state" তৈরি হয় না)
  if (!mainUrl) mainUrl = deduped[0];

  return {
    changed: true,
    images: deduped.map((url) => ({ url, isMain: url === mainUrl })),
  };
};

/**
 * existing + newly uploaded image মিলিয়ে final list তৈরি করে (update এর জন্য)।
 *
 * keepImages ও নতুন file — কোনোটিই না দিওয়া পর্যন্ত existing images অপরিবর্তিত
 * থাকে (changed:false)। ফলে image পাঠায় না এমন API caller update করলেও
 * existing image হারায় না।
 */
const mergeProductImages = ({
  currentImages = [],
  keepImages,
  mainRef,
  newFiles = [],
} = {}) => {
  const uploadedUrls = (Array.isArray(newFiles) ? newFiles : [])
    .map(fileToUrl)
    .filter(Boolean);

  if (keepImages === undefined && uploadedUrls.length === 0) {
    return { changed: false };
  }

  const currentList = Array.isArray(currentImages) ? currentImages : [];
  const existingUrls = new Set(
    currentList.map((img) => normalizeImageUrl(img && img.url)).filter(Boolean),
  );

  // --- keepImages parse + validate ---
  let keptUrls = [];
  if (keepImages !== undefined) {
    let list = keepImages;
    if (typeof keepImages === "string") {
      const raw = keepImages.trim();
      list = raw === "" ? [] : JSON.parse(raw);
    }
    if (!Array.isArray(list)) {
      throw new Error("Invalid image list");
    }
    for (const item of list) {
      const url = normalizeImageUrl(item);
      if (!url) continue;
      if (!existingUrls.has(url)) {
        // product-এর সাথে সম্পর্ক নেই এমন image reference save হবে না
        throw new Error("Invalid image reference");
      }
      keptUrls.push(url);
    }
  } else {
    keptUrls = [...existingUrls];
  }

  // duplicate reference বাদ দেওয়া হচ্ছে
  const finalUrls = [...new Set([...keptUrls, ...uploadedUrls])];

  if (finalUrls.length === 0) {
    throw new Error("At least one product image is required");
  }
  if (finalUrls.length > MAX_IMAGES) {
    throw new Error(`A product can have at most ${MAX_IMAGES} images`);
  }

  const finalUrlSet = new Set(finalUrls);

  // --- main image নির্ধারণ ---
  let mainUrl = resolveMainReference(mainRef, uploadedUrls, finalUrlSet);

  // main reference না দিওয়া পর্যন্ত আগের main টাই এখনো থাকলে সেটাই main থাকবে
  if (!mainUrl) {
    const previousMain = currentList.find((img) => img && img.isMain);
    const previousMainUrl = normalizeImageUrl(previousMain && previousMain.url);
    if (previousMainUrl && finalUrlSet.has(previousMainUrl)) {
      mainUrl = previousMainUrl;
    }
  }

  // আগের main নেই বা reference অবৈধ => প্রথম image main হবে, যাতে
  // "Main Image ছাড়া invalid product state" তৈরি না হয়
  if (!mainUrl) mainUrl = finalUrls[0];

  return {
    changed: true,
    images: finalUrls.map((url) => ({ url, isMain: url === mainUrl })),
  };
};

/**
 * যেকোনো ধরনের image list থেকে নিরাপদ main image বের করে (পড়ার সময়)।
 * legacy data-তে কোনো image-ই main না হলে প্রথমটিকে main হিসেবে ধরা হয়।
 */
const getMainImageUrl = (images) => {
  if (!Array.isArray(images) || images.length === 0) return "";
  const main = images.find((img) => img && img.isMain && normalizeImageUrl(img.url));
  const fallback = images.find((img) => img && normalizeImageUrl(img.url));
  return normalizeImageUrl((main || fallback || {}).url);
};

module.exports = {
  MAX_IMAGES,
  NEW_FILE_PREFIX,
  normalizeImageUrl,
  fileToUrl,
  resolveMainReference,
  buildImagesFromUploads,
  mergeProductImages,
  getMainImageUrl,
};
