/**
 * Bulk Product Upload — Database থেকে সব Product Excel-এ export করে।
 *
 * এই file এমনভাবে বানানো যাতে Download -> Edit -> আবার Bulk Upload করা যায়।
 * তাই export করার সময় ঠিক সেই রূপেই লেখা হয়, যা upload parser
 * (utils/bulkProductParsers.js) আবার পড়তে পারে:
 *
 *   - header        : ProductSchema-র field name (upload-এর হুবহু column)
 *   - tag           : array  -> "a, b"       (upload আবার array করে নেয়)
 *   - images        : subdoc -> "url1, url2" (Main image আগে রাখা হয়, যাতে
 *                                         re-upload করলে একই image main থাকে)
 *   - discount dates: Date    -> "YYYY-MM-DD" (timezone drift না হয়)
 *   - number field  : সত্যিকারের Number হিসেবে লেখা, string নয়
 *
 * কোনো তথ্য ইচ্ছাকৃতভাবে বাদ দেওয়া হয় না — প্রতিটি product-এর সব
 * schema field export করা হয়।
 */

const XLSX = require("xlsx");
const { COLUMN_DEFS, buildExampleRow } = require("./bulkProductColumns");
const { MAX_IMAGES, normalizeImageUrl } = require("./productImageUtils");

/**
 * Date -> "YYYY-MM-DD"।
 *
 * local getter ব্যবহার করা হচ্ছে কারণ upload parser এই format পড়ে
 * `new Date(y, m-1, d)` (local midnight) বানায়। ফলে export -> upload
 * round trip-এ দিন shift হয় না।
 */
const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * images subdoc array -> "url1, url2"।
 *
 * Main image কে অবশ্যই সামনে রাখতে হয়। কারণ upload করার সময় প্রথম
 * image-কেই Main ধরা হয় (productImageUtils-এর default rule), তাই Main
 * আগে না রাখলে re-upload করার পর অন্য কোনো image ভুলভাবে Main হয়ে যেত।
 * এখানে isMain:true subdoc-কে আগে সরিয়ে দেওয়া হচ্ছে, বাকিগুলোর ক্রম
 * অপরিবর্তিত থাকে।
 *
 * খালি url বাদ যায় (legacy data-তে `url: ""` পাওয়া যায়), এবং
 * productImageUtils-এর নিয়ম মেনে সর্বোচ্চ MAX_IMAGES রাখা হয়।
 */
const formatImages = (images) => {
  if (!Array.isArray(images) || images.length === 0) return "";

  const cleaned = images
    .map((img) => ({ url: normalizeImageUrl(img && img.url), isMain: Boolean(img && img.isMain) }))
    .filter((img) => img.url);

  // isMain:true আগে, বাকিগুলো সাধারণ stable order-এ
  const ordered = [
    ...cleaned.filter((img) => img.isMain),
    ...cleaned.filter((img) => !img.isMain),
  ];

  return [...new Set(ordered.map((img) => img.url))].slice(0, MAX_IMAGES).join(", ");
};

/** tag array -> "a, b"। খালি হলে ""। */
const formatTags = (tag) => {
  if (!Array.isArray(tag)) return "";
  return tag.map((t) => String(t).trim()).filter(Boolean).join(", ");
};

/**
 * Excel-এ লিখার আগে string থেকে অতিরিক্ত whitespace সরানো হয়।
 * (DB-তে কিছু title-এ trailing "\n" আছে — spreadsheet-এ তা লুকানো থাকে)
 */
const cleanText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

/** number field গুলোকে সত্যিকারের Number বানানো (Excel-এ text হিসেবে না দেখায়) */
const cleanNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
};

/**
 * একটি Product document -> Excel row (COLUMN_DEFS-এর ক্রমে)।
 *
 * @param {object} product mongoose document বা lean object
 * @returns {Array} header ক্রমে cell value
 */
const productToRow = (product) => {
  const p = product || {};

  const rowByField = {
    title: cleanText(p.title),
    sku: cleanText(p.sku),
    shortDescription: cleanText(p.shortDescription),
    description: cleanText(p.description),
    additionalInfo: cleanText(p.additionalInfo),
    price: cleanNumber(p.price),
    discountType: cleanText(p.discountType) || "none",
    discount: cleanNumber(p.discount),
    discountStartDate: formatDate(p.discountStartDate),
    discountEndtDate: formatDate(p.discountEndtDate),
    stock: cleanNumber(p.stock),
    brand: cleanText(p.brand),
    category: cleanText(p.category),
    tag: formatTags(p.tag),
    status: cleanText(p.status) || "pending",
    images: formatImages(p.images),
  };

  return COLUMN_DEFS.map((def) => rowByField[def.field] ?? "");
};

/**
 * সব product থেকে export workbook বানায়।
 *
 * @param {Array<object>} products DB থেকে আসা product
 * @returns {{ workbook:object, headers:string[] }}
 */
const buildExportWorkbook = (products) => {
  const list = Array.isArray(products) ? products : [];
  const headers = COLUMN_DEFS.map((def) => def.header);
  const dataRows = list.map(productToRow);

  const aoa = [headers, ...dataRows];

  // কোনো product না থাকলে example row দেওয়া হয়, যাতে file টেমপ্লেটের মতো
  // কাজ করে (header সহ ফাঁকা ফাইল)। তারিখগুলো ভবিষ্যতের হওয়ায় row টি সবসময় valid।
  if (list.length === 0) {
    aoa.push(buildExampleRow());
  }

  const productsSheet = XLSX.utils.aoa_to_sheet(aoa);

  // column width ঠিক করা হচ্ছে যাতে সব data পড়ার সময় দেখা যায়
  productsSheet["!cols"] = COLUMN_DEFS.map((def) => ({
    wch: Math.max(def.header.length + 2, 20),
  }));

  // header row filter — বড় ফাইলে খুঁজতে সহজ হয়
  if (dataRows.length > 0) {
    productsSheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: aoa.length - 1, c: headers.length - 1 },
      }),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, productsSheet, "Products");
  XLSX.utils.book_append_sheet(workbook, buildExportNotesSheet(), "Instructions");
  return { workbook, headers };
};

/** Instructions sheet — export করা file কীভাবে আবার upload করবে। */
const buildExportNotesSheet = () => {
  const rows = [
    ["Bulk Product Upload - Instructions"],
    [""],
    ["এই file-এ Database-এ থাকা সব Product-এর data export করা হয়েছে।"],
    ["Column header গুলো ProductSchema-র field name-ই, তাই ফাইলটি সরাসরি"],
    ["Bulk Product Upload দিয়ে আবার upload করা যাবে।"],
    [""],
    ["IMPORTANT - পুনরায় upload করার আগে:"],
    ["- title ও SKU unique। যে row Database-এ আগে থেকেই আছে সেগুলো আবার"],
    ["  upload করলে 'already exists' ধরে fail হবে — সেগুলো মুছে দিন, অথবা"],
    ["  শুধু নতুন/পরিবর্তিত row রাখুন।"],
    ["- discount-এর start/end date আজকের দিন বা পরে হতে হয়। যে product-এর"],
    ["  discount date ইতিমধ্যে পেরিয়ে গেছে, সেই row আবার upload হবে না —"],
    ["  সেগুলোর discount date আপডেট করে নিতে হবে।"],
    [""],
    ["Column", "Required", "Alias", "Description"],
    ...COLUMN_DEFS.map((def) => [
      def.header,
      def.required ? "Yes" : "No",
      def.aliases.join(", ") || "-",
      def.note || "",
    ]),
    [""],
    ["Rules (existing ProductSchema ও create API অনুযায়ী):"],
    ["- প্রতিটি row-এর image comma separated, প্রথমটি Main Image হবে।"],
    ["- discountType: none | percent | flat"],
    ["- status: pending | active | inactive"],
    ["- percent discount 100 এর বেশি হতে পারবে না।"],
    ["- discount তারিখ আজকের দিন বা তার পরে হতে হবে (YYYY-MM-DD)।"],
    ["- stock অবশ্যই 1 বা তার বেশি হতে হবে।"],
    ["- SKU খালি রাখলে backend স্বয়ংক্রিয়ভাবে unique SKU generate করবে।"],
    ["- কোনো row invalid হলে শুধু ওই row বাদ পড়বে, বাকিগুলো upload হবে।"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 40 }, { wch: 70 }];
  return sheet;
};

/** export file-এর binary buffer (download response-এ পাঠানোর জন্য) */
const buildExportBuffer = (products) => {
  const { workbook } = buildExportWorkbook(products);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

module.exports = {
  productToRow,
  buildExportWorkbook,
  buildExportBuffer,
  formatDate,
  formatImages,
  formatTags,
};
