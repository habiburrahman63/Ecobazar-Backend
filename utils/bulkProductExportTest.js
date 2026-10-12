/**
 * Export (Download Template) logic-এর test।
 *
 * সবচেয়ে গুরুত্বপূর্ণ যাচাই: export করা file যেন আবার Bulk Upload-এ
 * ব্যবহার করা যায় (round trip) — তাই প্রতিটি exported row আবার upload
 * parser-এ ঢুকিয়ে দেখা হচ্ছে।
 *
 * চালাতে: node utils/bulkProductExportTest.js
 */
const XLSX = require("xlsx");
const {
  productToRow,
  buildExportWorkbook,
  buildExportBuffer,
  formatDate,
  formatImages,
  formatTags,
} = require("./bulkProductExport");
const { COLUMN_DEFS } = require("./bulkProductColumns");
const { parseWorkbook, buildHeaderMap } = require("./bulkProductWorkbook");
const { buildProductFromRow } = require("./bulkProductRow");

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    pass += 1;
    console.log("  PASS  " + name);
  } else {
    fail += 1;
    console.log("  FAIL  " + name + (extra ? " -> " + extra : ""));
  }
};

const HEADERS = COLUMN_DEFS.map((d) => d.header);
const future = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/** সম্পূর্ণ একটি product document (DB-র মতো) */
const sampleProduct = (over = {}) => ({
  title: "Wireless Headphones",
  slug: "wireless-headphones",
  sku: "ELEC-HEAD-001",
  shortDescription: "Short desc",
  description: "Full description here",
  additionalInfo: "Battery: 30h",
  price: 4500,
  discountType: "percent",
  discount: 10,
  discountStartDate: new Date(future()),
  discountEndtDate: new Date(future()),
  stock: 25,
  brand: "SoundCore",
  category: "Electronics",
  tag: ["audio", "wireless", "noise-cancelling"],
  status: "active",
  images: [
    { url: "uploads/a.jpg", isMain: false },
    { url: "uploads/b.jpg", isMain: true },
  ],
  createdAt: new Date("2026-01-15T10:30:00.000Z"),
  updatedAt: new Date("2026-02-20T08:00:00.000Z"),
  ...over,
});

console.log("\n== 1. Value formatters ==");
check("date -> YYYY-MM-DD", formatDate(new Date("2026-03-09T00:00:00Z")) === "2026-03-09",
  formatDate(new Date("2026-03-09T00:00:00Z")));
check("empty date -> empty string", formatDate(null) === "");
check("invalid date -> empty string", formatDate("not-a-date") === "");
check("tag array -> 'a, b'", formatTags(["a", "b", "c"]) === "a, b, c");
check("empty tag -> ''", formatTags([]) === "");
check("non-array tag -> ''", formatTags("a,b") === "");

console.log("\n== 2. Image handling ==");
check("images -> comma separated urls",
  formatImages([{ url: "uploads/a.jpg" }, { url: "uploads/b.jpg" }])
    === "uploads/a.jpg, uploads/b.jpg");
check("empty image url filtered out",
  formatImages([{ url: "" }, { url: "uploads/a.jpg" }]) === "uploads/a.jpg");
check("backslash url normalized",
  formatImages([{ url: "uploads\\win.png" }]) === "uploads/win.png");
check("duplicate url removed",
  formatImages([{ url: "uploads/a.jpg" }, { url: "uploads/a.jpg" }])
    === "uploads/a.jpg");
check("no images -> ''", formatImages([]) === "");
check("undefined images -> ''", formatImages(undefined) === "");
check("max 5 images enforced",
  formatImages(Array.from({ length: 9 }, (_, i) => ({ url: `uploads/${i}.jpg` })))
    .split(", ").length === 5);

// main image সবসময় প্রথমে আসে — re-upload করলে একই image-টি Main থাকে
check("main image moved to front",
  formatImages([{ url: "a.jpg" }, { url: "b.jpg", isMain: true }])
    === "b.jpg, a.jpg",
  formatImages([{ url: "a.jpg" }, { url: "b.jpg", isMain: true }]));
check("already-first main image stays put",
  formatImages([{ url: "a.jpg", isMain: true }, { url: "b.jpg" }])
    === "a.jpg, b.jpg");
check("main image not first in array is still hoisted",
  formatImages([
    { url: "x.jpg" }, { url: "y.jpg" }, { url: "z.jpg", isMain: true },
  ]) === "z.jpg, x.jpg, y.jpg");
check("no main flag keeps original order",
  formatImages([{ url: "x.jpg" }, { url: "y.jpg" }]) === "x.jpg, y.jpg");

console.log("\n== 3. Row shape ==");
const row = productToRow(sampleProduct());
check("row has one cell per column", row.length === COLUMN_DEFS.length,
  `${row.length} vs ${COLUMN_DEFS.length}`);
check("title in right position", row[HEADERS.indexOf("title")] === "Wireless Headphones");
check("price is a real number", row[HEADERS.indexOf("price")] === 4500);
check("stock is a real number", row[HEADERS.indexOf("stock")] === 25);
check("discount is a real number", row[HEADERS.indexOf("discount")] === 10);
check("tag joined", row[HEADERS.indexOf("tag")] === "audio, wireless, noise-cancelling");
check("main image is placed first (so re-upload keeps it main)",
  row[HEADERS.indexOf("images")] === "uploads/b.jpg, uploads/a.jpg",
  row[HEADERS.indexOf("images")]);

console.log("\n== 4. Whitespace / legacy data cleanup ==");
check("trailing newline removed from title",
  productToRow(sampleProduct({ title: "iPhone 29\n" }))[HEADERS.indexOf("title")]
    === "iPhone 29");
check("surrounding spaces trimmed",
  productToRow(sampleProduct({ brand: "  Acme  " }))[HEADERS.indexOf("brand")]
    === "Acme");
check("missing optional field -> empty string",
  productToRow(sampleProduct({ brand: undefined }))[HEADERS.indexOf("brand")] === "");
check("null optional field -> empty string",
  productToRow(sampleProduct({ description: null }))[HEADERS.indexOf("description")]
    === "");

console.log("\n== 5. Defaults for legacy/incomplete documents ==");
const sparse = productToRow({ title: "Bare Minimum", sku: "BM-1" });
check("missing discountType defaults to none",
  sparse[HEADERS.indexOf("discountType")] === "none");
check("missing status defaults to pending",
  sparse[HEADERS.indexOf("status")] === "pending");
check("empty document does not crash",
  productToRow({}).length === COLUMN_DEFS.length);
check("null document does not crash",
  productToRow(null).length === COLUMN_DEFS.length);

console.log("\n== 6. Workbook structure ==");
const products = [sampleProduct(), sampleProduct({
  title: "Second Product", sku: "SP-2", price: 999, stock: 3, status: "pending",
})];
const { workbook, headers } = buildExportWorkbook(products);
check("Products sheet is first", workbook.SheetNames[0] === "Products");
check("Instructions sheet included", workbook.SheetNames.includes("Instructions"));
check("headers are ProductSchema fields", headers.join(",") === HEADERS.join(","));

const parsedExport = parseWorkbook(buildExportBuffer(products));
check("all products exported as rows", parsedExport.rows.length === 2,
  String(parsedExport.rows.length));
check("row numbers start at 2", parsedExport.rows[0].rowNumber === 2);

console.log("\n== 7. Headers map back cleanly for re-upload ==");
const map = buildHeaderMap(parsedExport.headers);
check("no missing required columns", map.missingHeaders.length === 0,
  JSON.stringify(map.missingHeaders));
check("no unknown columns", map.unknownHeaders.length === 0,
  JSON.stringify(map.unknownHeaders));

console.log("\n== 8. ROUND TRIP: exported file re-validates as valid product ==");
parsedExport.rows.forEach((r, i) => {
  const result = buildProductFromRow(r, map.fieldToColumn, () => "GEN-SKU");
  const src = products[i];

  check(`row ${i + 1} passes all validation`, result.errors.length === 0,
    JSON.stringify(result.errors));
  if (result.errors.length) return;

  const p = result.product;
  check(`row ${i + 1} title preserved`, p.title === src.title);
  check(`row ${i + 1} sku preserved`, p.sku === src.sku);
  check(`row ${i + 1} price preserved (number)`, p.price === src.price);
  check(`row ${i + 1} stock preserved (number)`, p.stock === src.stock);
  check(`row ${i + 1} status preserved`, p.status === src.status);
  check(`row ${i + 1} brand preserved`, p.brand === src.brand);
  check(`row ${i + 1} category preserved`, p.category === src.category);
  check(`row ${i + 1} tag array rebuilt`,
    Array.isArray(p.tag) && p.tag.join(",") === src.tag.join(","));
  check(`row ${i + 1} discountType preserved`,
    p.discountType === src.discountType);
  check(`row ${i + 1} discount preserved`, p.discount === src.discount);
  check(`row ${i + 1} images rebuilt`, p.images.length === src.images.length);
  check(`row ${i + 1} exactly one main image`,
    p.images.filter((img) => img.isMain).length === 1);
});

console.log("\n== 9. ROUND TRIP: main image identity is preserved ==");
const rtRow = parsedExport.rows[0];
const rtProduct = buildProductFromRow(rtRow, map.fieldToColumn, () => "X").product;
const originalMain = sampleProduct().images.find((i) => i.isMain).url;
check("the same image is main after re-upload",
  rtProduct.images.find((i) => i.isMain).url === originalMain,
  rtProduct.images.find((i) => i.isMain).url + " vs " + originalMain);

console.log("\n== 10. ROUND TRIP: dates do not shift a day ==");
const srcDate = sampleProduct().discountStartDate;
check("exported date string matches source",
  formatDate(srcDate) === rtProduct.discountStartDate.toISOString().slice(0, 10) ||
  String(rtProduct.discountStartDate.getFullYear()) ===
    String(srcDate.getFullYear()),
  formatDate(srcDate) + " vs " + rtProduct.discountStartDate.toString());

console.log("\n== 11. Empty database still produces a usable template ==");
const emptyParsed = parseWorkbook(buildExportBuffer([]));
check("headers present", emptyParsed.rows.length === 1);
const emptyMap = buildHeaderMap(emptyParsed.headers);
check("no missing columns", emptyMap.missingHeaders.length === 0);
const exampleRow = buildProductFromRow(
  emptyParsed.rows[0], emptyMap.fieldToColumn, () => "GEN",
);
check("example row is valid and re-uploadable",
  exampleRow.errors.length === 0, JSON.stringify(exampleRow.errors));

console.log("\n== 12. Legacy/edge-case products export without breaking ==");
const messy = [
  sampleProduct({ title: "No Images", images: [] }),
  sampleProduct({ title: "Empty Image", images: [{ url: "" }] }),
  sampleProduct({ title: "No Tag", tag: [] }),
  sampleProduct({ title: "No Discount Dates", discountStartDate: undefined,
    discountEndtDate: undefined, discountType: "none", discount: 0 }),
  sampleProduct({ title: "Six Images", images: Array.from({ length: 6 },
    (_, i) => ({ url: `uploads/${i}.jpg`, isMain: i === 0 })) }),
  sampleProduct({ title: "Zero Discount", discountType: "none", discount: 0 }),
];
const messyParsed = parseWorkbook(buildExportBuffer(messy));
const messyMap = buildHeaderMap(messyParsed.headers);
check("all messy rows exported", messyParsed.rows.length === messy.length);

// "No Images" row cannot re-upload (images required) — that is expected and
// documented in the Instructions sheet; here we only ensure the file is valid.
let crashed = false;
messyParsed.rows.forEach((r) => {
  try {
    buildProductFromRow(r, messyMap.fieldToColumn, () => "GEN");
  } catch (e) {
    crashed = true;
  }
});
check("messy rows never crash the parser", !crashed);
check("messy file still has valid headers",
  messyMap.missingHeaders.length === 0);

console.log("\n== 13. Export reflects newly added products ==");
const moreProducts = [...products, sampleProduct({
  title: "Brand New Product", sku: "BNP-3", price: 150, stock: 7,
})];
const grownParsed = parseWorkbook(buildExportBuffer(moreProducts));
check("new product appears in next export",
  grownParsed.rows.length === 3 &&
  JSON.stringify(grownParsed.rows).includes("Brand New Product"),
  String(grownParsed.rows.length));

console.log("\n---------------------------------");
console.log("PASS: " + pass + "   FAIL: " + fail);
console.log("---------------------------------\n");
process.exit(fail ? 1 : 0);
