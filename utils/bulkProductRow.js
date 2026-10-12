/**
 * Bulk Product Upload — Excel row -> ProductSchema document।
 *
 * এখানে কোনো নতুন rule নেই। যে নিয়মগুলো লাগানো হয়েছে সবই আগে থেকেই ছিল:
 *
 *   - title / price / stock / images required   (ProductForm + create API)
 *   - stock >= 1                                ("Stock must be a greater then 0")
 *   - discountType enum                         (ProductSchema: percent|flat|none)
 *   - discount min 0, percent <= 100            (ProductSchema min + create API)
 *   - flat discount < price                     (create API flat rule)
 *   - discount start/end আজকের আগে নয়         ("Start date Current theke Choto hbe na")
 *   - exactly one main image, সর্বোচ্চ ৫টি     (productImageUtils)
 *   - slug = slugify(title)                     (schema pre("save") hook)
 *
 * তাই Bulk Upload existing create validation-কেই হুবহু অনুসরণ করে।
 */

const slugify = require("slugify");
const { isEmpty } = require("./bulkProductColumns");
const {
  parseNumber,
  parseDate,
  normalizeDiscountType,
  normalizeStatus,
  buildImagesFromUrls,
} = require("./bulkProductParsers");

/** নির্দিষ্ট তারিখের দিনের শুরু (সময় অংশ বাদ দিয়ে) */
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * একটি Excel row validate করে ProductSchema document তৈরি করে।
 *
 * @param {{rowNumber:number, cells:any[]}} row
 * @param {Map<string, number>} fieldToColumn schema field -> column index
 * @param {() => string} skuFactory SKU না দেওয়া থাকলে unique SKU বানায়
 * @returns {{ product?:object, errors:string[], title:string, sku?:string }}
 */
const buildProductFromRow = (row, fieldToColumn, skuFactory) => {
  const errors = [];
  const cells = row.cells;

  /** নির্দিষ্ট schema field-এর cell value বের করে */
  const cell = (field) => {
    const index = fieldToColumn.get(field);
    return index === undefined ? undefined : cells[index];
  };

  /** string হিসেবে পড়ে trim করে (খালি হলে undefined) */
  const text = (field) =>
    isEmpty(cell(field)) ? undefined : String(cell(field)).trim();

  const title = text("title") || "";
  if (!title) errors.push("title is required");

  /* ---------------- price ---------------- */
  const priceResult = parseNumber(cell("price"));
  let price;
  if (!priceResult.ok) {
    errors.push("price must be a valid number");
  } else if (priceResult.value === undefined) {
    errors.push("price is required");
  } else {
    price = priceResult.value;
    // ProductForm frontend: "Enter a valid price"
    if (!(price > 0)) errors.push("price must be greater than 0");
  }

  /* ---------------- stock ---------------- */
  const stockResult = parseNumber(cell("stock"));
  let stock;
  if (!stockResult.ok) {
    errors.push("stock must be a valid number");
  } else if (stockResult.value === undefined) {
    errors.push("stock is required");
  } else {
    stock = stockResult.value;
    // createProductControleer: "Stock must be a greater then 0"
    if (!stock || stock < 1) errors.push("stock must be greater than 0");
  }

  /* ---------------- discountType / discount ---------------- */
  const discountType = normalizeDiscountType(cell("discountType"));
  if (discountType === null) {
    errors.push("discountType must be one of: none, percent, flat");
  }

  let discount = 0;
  const discountResult = parseNumber(cell("discount"));
  if (!discountResult.ok) {
    errors.push("discount must be a valid number");
  } else if (discountResult.value !== undefined) {
    discount = discountResult.value;
    // ProductSchema: discount min 0
    if (discount < 0) errors.push("discount cannot be negative");
  }

  if (discountType === "percent" && discount > 100) {
    // createProductControleer: percent হলে 100 এর বেশি discount নয়
    errors.push("discount cannot be greater than 100 for percent discountType");
  }

  if (discountType === "flat" && typeof price === "number" && discount >= price) {
    errors.push("flat discount must be less than price");
  }

  if (discountType === "none") discount = 0;

  /* ---------------- discount dates ---------------- */
  const today = startOfDay(new Date());

  const startResult = parseDate(cell("discountStartDate"));
  let discountStartDate;
  if (!startResult.ok) {
    errors.push("discountStartDate must be a valid date (YYYY-MM-DD)");
  } else if (startResult.value) {
    discountStartDate = startResult.value;
    // createProductControleer: "Start date Current theke Choto hbe na"
    if (today > startOfDay(discountStartDate)) {
      errors.push("discountStartDate cannot be earlier than today");
    }
  }

  const endResult = parseDate(cell("discountEndtDate"));
  let discountEndtDate;
  if (!endResult.ok) {
    errors.push("discountEndtDate must be a valid date (YYYY-MM-DD)");
  } else if (endResult.value) {
    discountEndtDate = endResult.value;
    // createProductControleer: "End date Current theke Choto hbe na"
    if (today > startOfDay(discountEndtDate)) {
      errors.push("discountEndtDate cannot be earlier than today");
    }
  }

  if (
    discountStartDate &&
    discountEndtDate &&
    startOfDay(discountStartDate) > startOfDay(discountEndtDate)
  ) {
    errors.push("discountEndtDate must be on or after discountStartDate");
  }

  /* ---------------- status ---------------- */
  const status = normalizeStatus(cell("status"));
  if (status === null) {
    errors.push("status must be one of: pending, active, inactive");
  }

  /* ---------------- images ---------------- */
  let images;
  const rawImages = cell("images");
  if (isEmpty(rawImages)) {
    // createProductControleer: "At least one product image is required"
    errors.push("at least one product image is required");
  } else {
    const urlList = Array.isArray(rawImages)
      ? rawImages.map(String)
      : String(rawImages).split(",");
    try {
      images = buildImagesFromUrls(urlList);
    } catch (imageError) {
      errors.push(imageError.message);
    }
  }

  /* ---------------- sku ---------------- */
  const rawSku = cell("sku");
  const skuProvided = !isEmpty(rawSku);
  const sku = skuProvided ? String(rawSku).trim() : skuFactory();

  if (errors.length) {
    return { errors, title, sku: skuProvided ? sku : undefined };
  }

  /* ---------------- ProductSchema document ---------------- */
  const product = {
    title,
    sku,
    shortDescription: text("shortDescription"),
    description: text("description"),
    additionalInfo: text("additionalInfo"),
    price,
    discountType,
    discount,
    discountStartDate,
    discountEndtDate,
    stock,
    brand: text("brand"),
    category: text("category"),
    // create API-র মতোই comma separated string -> array
    tag: (text("tag") || "").split(",").map((t) => t.trim()).filter(Boolean),
    status,
    images,
    // schema pre("save") hook insertMany-তে চলে না, তাই slug এখানেই বানানো হচ্ছে
    slug: slugify(title, { lower: true, strict: true }),
  };

  // খালি field বাদ দেওয়া হয়, যাতে schema-র default কাজ করে
  Object.keys(product).forEach((key) => {
    if (product[key] === undefined) delete product[key];
  });

  return { product, errors: [], title, sku };
};

module.exports = { buildProductFromRow };
