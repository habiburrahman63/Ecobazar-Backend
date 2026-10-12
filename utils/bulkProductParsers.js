/**
 * Bulk Product Upload — Excel cell value -> ProductSchema value parsers।
 *
 * প্রতিটি parser এমনভাবে বানানো যাতে existing create API-র validation
 * একইভাবে প্রযোজ্য হয়: parse ব্যর্থ হলে row-level error দেখানো হয়,
 * silently ভুল value বসানো হয় না।
 */

const XLSX = require("xlsx");
const { normalizeKey, isEmpty } = require("./bulkProductColumns");
const { normalizeImageUrl, MAX_IMAGES } = require("./productImageUtils");

/** "1,200" বা "৳4500" লেখা cell থেকে সংখ্যা বের করার সময় বাদ দেওয়া chars */
const NUMERIC_NOISE = /[৳$,\s]/g;

/**
 * সংখ্যা parse করে। parse করা না গেলে { ok:false } ফেরত দেয়, যাতে
 * admin-কে "price must be a valid number" টাইপ clear error দেখানো যায়।
 */
const parseNumber = (raw) => {
  if (isEmpty(raw)) return { ok: true, value: undefined };

  // Excel সাধারণত number cell কে number হিসেবেই দেয়, string হলে ধরে নিই।
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false };
  }

  const cleaned = String(raw).replace(NUMERIC_NOISE, "");
  if (cleaned === "" || !/^-?\d*\.?\d+$/.test(cleaned)) return { ok: false };

  const value = Number(cleaned);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
};

/** Date cell -> Date object। JS Date, Excel serial ও string — সব ধরা হয়। */
const parseDate = (raw) => {
  if (isEmpty(raw)) return { ok: true, value: undefined };

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime())
      ? { ok: false }
      : { ok: true, value: raw };
  }

  // cellDates:false হলে Excel serial number আসতে পারে (1900 epoch)
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return { ok: false };
    const date = new Date(parsed.y, parsed.m - 1, parsed.d);
    return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, value: date };
  }

  const text = String(raw).trim();

  // "2026-10-01 00:00:00" -> "2026-10-01" (time zone drift এড়াতে date part ধরা হয়)
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
    return Number.isNaN(date.getTime())
      ? { ok: false }
      : { ok: true, value: date };
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, value: date };
};

/**
 * discountType normalize। ProductSchema enum: percent | flat | none।
 * ProductForm frontend "percentage" পাঠায়, তাই সেটাও "percent" হিসেবে ধরা হয়।
 * enum-এর বাইরে হলে null -> row error।
 */
const normalizeDiscountType = (raw) => {
  if (isEmpty(raw)) return "none"; // create API-র default
  const value = normalizeKey(raw);
  if (["percent", "percentage", "pct"].includes(value)) return "percent";
  if (["flat", "fixed", "flatrate", "fixedamount"].includes(value)) return "flat";
  if (["none", "nodiscount", "no"].includes(value)) return "none";
  return null;
};

/** status normalize (ProductSchema enum)। খালি হলে schema default "pending"। */
const normalizeStatus = (raw) => {
  if (isEmpty(raw)) return "pending";
  const value = normalizeKey(raw);
  if (["pending", "active", "inactive"].includes(value)) return value;
  return null;
};

/**
 * Excel থেকে আসা URL list -> ProductSchema-র images subdocument array।
 * productImageUtils-এর নিয়মই অনুসরণ করে: url normalize, duplicate বাদ,
 * সর্বোচ্চ MAX_IMAGES, আর ঠিক একটি isMain:true।
 */
const buildImagesFromUrls = (urls) => {
  const normalized = [...new Set(urls.map(normalizeImageUrl).filter(Boolean))];

  if (normalized.length === 0) {
    throw new Error("At least one product image is required");
  }
  if (normalized.length > MAX_IMAGES) {
    throw new Error(`A product can have at most ${MAX_IMAGES} images`);
  }

  // কোনো main reference না থাকলে প্রথম image-কে Main করা হয় (একই default rule)
  const mainUrl = normalized[0];
  return normalized.map((url) => ({ url, isMain: url === mainUrl }));
};

module.exports = {
  parseNumber,
  parseDate,
  normalizeDiscountType,
  normalizeStatus,
  buildImagesFromUrls,
};
