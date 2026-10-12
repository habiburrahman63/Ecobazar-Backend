/**
 * Bulk Product Upload — Excel column <-> ProductSchema field mapping.
 *
 * এই map-ই বলে দেয় কোন Excel column কোন ProductSchema field-এ যাবে।
 * `header` = template file-এর canonical column নাম (schema field name-ই),
 * `aliases` = admin চাইলে যে নামেও ওই column লিখতে পারবে,
 * `required` = single create API-র মতোই mandatory।
 */

const { MAX_IMAGES } = require("./productImageUtils");

/** header normalize: "Product Title" / "product_title" -> "producttitle" */
const normalizeKey = (value) =>
  String(value === undefined || value === null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** value খালি কিনা (0 ও false খালি নয়) */
const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "");

/** একসাথে সর্বোচ্চ কত row process করা হবে (stability guard) */
const MAX_UPLOAD_ROWS = 5000;

/** upload করা যাবে এমন সর্বোচ্চ file size (multer-এও এই limit ব্যবহার হয়) */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/** Excel column definition — ProductSchema field-এর সাথে ১:১ মিল। */
const COLUMN_DEFS = [
  {
    header: "title",
    field: "title",
    required: true,
    aliases: ["producttitle", "name", "productname"],
    example: "Wireless Headphones",
    note: "আগে থেকে এই title-এর product থাকা যাবে না (ProductSchema: unique)",
  },
  {
    header: "sku",
    field: "sku",
    required: false,
    aliases: ["productsku", "code", "productcode"],
    example: "ELEC-HEAD-001",
    note: "খালি রাখলে backend নিজে unique SKU generate করবে (unique + sparse)",
  },
  {
    header: "shortDescription",
    field: "shortDescription",
    required: false,
    aliases: ["shortdesc", "subtitle", "shortdescription"],
    example: "One-line summary shown on product cards",
    note: "",
  },
  {
    header: "description",
    field: "description",
    required: false,
    aliases: ["fulldescription", "desc", "details", "longdescription"],
    example: "Over-ear wireless headphone with active noise cancellation.",
    note: "",
  },
  {
    header: "additionalInfo",
    field: "additionalInfo",
    required: false,
    aliases: [
      "additionalinformation",
      "additionaldetails",
      "specs",
      "specification",
    ],
    example: "Battery: 30h | Driver: 40mm",
    note: "",
  },
  {
    header: "price",
    field: "price",
    required: true,
    aliases: ["productprice", "sellingprice", "saleprice"],
    example: "4500",
    note: "সংখ্যা হতে হবে এবং 0 এর চেয়ে বড় হতে হবে",
  },
  {
    header: "discountType",
    field: "discountType",
    required: false,
    aliases: ["type"],
    example: "none",
    note: "none | percent | flat (ProductSchema enum)",
  },
  {
    header: "discount",
    field: "discount",
    required: false,
    aliases: ["discountvalue", "discountamount"],
    example: "10",
    note: "min 0 | percent হলে 100 এর বেশি নয়",
  },
  {
    header: "discountStartDate",
    field: "discountStartDate",
    required: false,
    aliases: ["discountstart", "startdate"],
    example: "2026-10-01",
    note: "আজকের দিন বা তার পরে হতে হবে (YYYY-MM-DD)",
  },
  {
    header: "discountEndtDate",
    field: "discountEndtDate",
    required: false,
    aliases: ["discountenddate", "discountend", "enddate"],
    example: "2026-12-31",
    note: "ProductSchema field নামেই 'discountEndtDate'। আজকের দিন বা পরে হবে",
  },
  {
    header: "stock",
    field: "stock",
    required: true,
    aliases: ["stockquantity", "quantity", "qty", "stockqty", "available"],
    example: "25",
    note: "1 বা তার বেশি হতে হবে (create API: stock must be greater than 0)",
  },
  {
    header: "brand",
    field: "brand",
    required: false,
    aliases: ["brandname", "manufacturer"],
    example: "SoundCore",
    note: "",
  },
  {
    header: "category",
    field: "category",
    required: false,
    aliases: ["categories", "productcategory"],
    example: "Electronics",
    note: "",
  },
  {
    header: "tag",
    field: "tag",
    required: false,
    aliases: ["tags"],
    example: "audio, wireless, noise-cancelling",
    note: "comma separated — create API-র মতোই array-তে convert হবে",
  },
  {
    header: "status",
    field: "status",
    required: false,
    aliases: ["productstatus"],
    example: "pending",
    note: "pending | active | inactive (ProductSchema enum, default: pending)",
  },
  {
    header: "images",
    field: "images",
    required: true,
    aliases: [
      "image",
      "imageurl",
      "imageurls",
      "productimage",
      "productimages",
      "photo",
      "photos",
    ],
    example: "uploads/headphone-1.jpg, uploads/headphone-2.jpg",
    note: `কমপক্ষে ১টি, সর্বোচ্চ ${MAX_IMAGES}টি image (comma separated)। প্রথমটি Main Image`,
  },
];

/** normalized header/alias -> column definition */
const HEADER_LOOKUP = COLUMN_DEFS.reduce((acc, def) => {
  [def.header, ...def.aliases].forEach((key) => {
    acc[normalizeKey(key)] = def;
  });
  return acc;
}, {});

/** যেসব column অবশ্যই ফাইলে থাকতে হবে */
const REQUIRED_HEADERS = COLUMN_DEFS.filter((d) => d.required).map(
  (d) => d.header,
);

/**
 * আজকের দিনের পরের মাস -> "YYYY-MM-DD"।
 *
 * Template-এর example row-তে discount date আজকের বা তার পরে হতে হয়
 * (upload validation rule)। তাই hardcoded তারিখ বসালে কিছুদিন পর সেটা
 * অতীত হয়ে যেত এবং example row নিজেই upload হতো না। তাই তারিখ গণনা করে
 * বসানো হচ্ছে, যাতে template সবসময় ব্যবহারযোগ্য থাকে।
 */
const futureMonthDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/** আজকের দিনের পরের বছর -> "YYYY-MM-DD" (discount end example) */
const nextYearDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Template-এর example row (COLUMN_DEFS-এর ক্রমে)।
 * Date field গুলো সবসময় ভবিষ্যতের তারিখ দেয়, তাই row টি সবসময় valid।
 */
const buildExampleRow = () =>
  COLUMN_DEFS.map((def) => {
    if (def.field === "discountStartDate") return futureMonthDate();
    if (def.field === "discountEndtDate") return nextYearDate();
    return def.example;
  });

module.exports = {
  COLUMN_DEFS,
  HEADER_LOOKUP,
  REQUIRED_HEADERS,
  MAX_UPLOAD_ROWS,
  MAX_FILE_SIZE,
  normalizeKey,
  isEmpty,
  buildExampleRow,
  futureMonthDate,
  nextYearDate,
};
