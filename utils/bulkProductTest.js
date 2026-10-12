/**
 * Bulk upload logic-এর smoke test (DB ছাড়াই)।
 * চালাতে: node utils/bulkProductTest.js
 */
const XLSX = require("xlsx");
const { parseWorkbook, buildHeaderMap } = require("./bulkProductWorkbook");
const { buildProductFromRow } = require("./bulkProductRow");
const { buildExportBuffer } = require("./bulkProductExport");

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

const HEADERS = [
  "title", "sku", "shortDescription", "description", "additionalInfo", "price",
  "discountType", "discount", "discountStartDate", "discountEndtDate", "stock",
  "brand", "category", "tag", "status", "images",
];

/** row cells -> ProductSchema document (header map ব্যবহার করে) */
const toProduct = (cells, skuFactory = () => "AUTO-SKU") => {
  const { fieldToColumn } = buildHeaderMap(HEADERS);
  return buildProductFromRow({ rowNumber: 2, cells }, fieldToColumn, skuFactory);
};

/** index i তে value বসিয়ে নতুন cells বানায় */
const swap = (i, value) => valid.map((v, idx) => (idx === i ? value : v));

/** একাধিক index একসাথে বদলানো */
const swapMany = (map) =>
  valid.map((v, idx) => (map[idx] !== undefined ? map[idx] : v));

const future = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};
const past = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
};

const valid = [
  "Wireless Headphones", "ELEC-HEAD-001", "Short", "Long desc", "Info", 4500,
  "percent", 10, future(), future(), 25, "SoundCore", "Electronics",
  "audio, wireless", "active", "uploads/a.jpg, uploads/b.jpg",
];

console.log("\n== 1. Valid row maps to a correct ProductSchema document ==");
const ok = toProduct(valid);
check("no errors", ok.errors.length === 0, JSON.stringify(ok.errors));
check("title kept", ok.product.title === "Wireless Headphones");
check("price is number", ok.product.price === 4500);
check("stock is number", ok.product.stock === 25);
check("discountType mapped", ok.product.discountType === "percent");
check("discount number", ok.product.discount === 10);
check("tag -> array", Array.isArray(ok.product.tag) && ok.product.tag.length === 2);
check("images subdocs", Array.isArray(ok.product.images) && ok.product.images.length === 2);
check("exactly one main image",
  ok.product.images.filter((i) => i.isMain).length === 1);
check("first image is main", ok.product.images[0].isMain === true);
check("slug generated", ok.product.slug === "wireless-headphones");
check("sku kept", ok.product.sku === "ELEC-HEAD-001");
check("status kept", ok.product.status === "active");
check("dates are Date objects",
  ok.product.discountStartDate instanceof Date &&
  ok.product.discountEndtDate instanceof Date);

console.log("\n== 2. Required / type validation mirrors create API ==");
check("missing title fails",
  toProduct(swap(0, "")).errors.includes("title is required"));
check("missing price fails",
  toProduct(swap(5, "")).errors.includes("price is required"));
check("non-numeric price fails",
  toProduct(swap(5, "abc")).errors.includes("price must be a valid number"));
check("price 0 fails",
  toProduct(swap(5, "0")).errors.includes("price must be greater than 0"));
check("missing stock fails",
  toProduct(swap(10, "")).errors.includes("stock is required"));
check("stock 0 fails",
  toProduct(swap(10, "0")).errors.includes("stock must be greater than 0"));
check("missing image fails",
  toProduct(swap(15, "")).errors.includes("at least one product image is required"));
check("more than 5 images fails",
  toProduct(swap(15, "a.jpg,b.jpg,c.jpg,d.jpg,e.jpg,f.jpg"))
    .errors.some((e) => e.includes("at most 5")));

console.log("\n== 3. Discount rules mirror create API ==");
check("percent > 100 fails",
  toProduct(swap(7, "150")).errors.some((e) => e.includes("greater than 100")));
check("negative discount fails",
  toProduct(swap(7, "-5")).errors.includes("discount cannot be negative"));
check("invalid discountType fails",
  toProduct(swap(6, "mega")).errors.some((e) => e.includes("discountType must be one of")));
check("flat discount >= price fails",
  toProduct(swapMany({ 6: "flat", 7: "5000" }))
    .errors.includes("flat discount must be less than price"));
check("'percentage' -> percent",
  toProduct(swap(6, "percentage")).product.discountType === "percent");
check("'none' -> discount 0",
  toProduct(swapMany({ 6: "none", 7: "50" })).product.discount === 0);

console.log("\n== 4. Date rules mirror create API ==");
check("past start date fails",
  toProduct(swap(8, past())).errors.some((e) => e.includes("discountStartDate cannot be earlier")));
check("past end date fails",
  toProduct(swap(9, past())).errors.some((e) => e.includes("discountEndtDate cannot be earlier")));
check("invalid date fails",
  toProduct(swap(8, "not-a-date")).errors.some((e) => e.includes("must be a valid date")));
check("end before start fails",
  toProduct(swapMany({ 8: "2030-01-05", 9: "2030-01-02" }))
    .errors.some((e) => e.includes("on or after")));
check("valid range start<end passes",
  toProduct(swapMany({ 8: "2030-01-01", 9: "2030-01-05" }))
    .errors.filter((e) => e.includes("on or after")).length === 0);

console.log("\n== 5. Status enum + SKU ==");
check("invalid status fails",
  toProduct(swap(14, "archived")).errors.some((e) => e.includes("status must be one of")));
check("empty status defaults to pending",
  toProduct(swap(14, "")).product.status === "pending");

let counter = 0;
check("auto sku used when blank",
  toProduct(swap(1, ""), () => "AUTO-" + ++counter).product.sku === "AUTO-1");

console.log("\n== 6. Header mapping: aliases + required columns ==");
const aliased = buildHeaderMap([
  "Product Title", "Product Price", "Qty", "Category", "Image URL",
]);
check("alias 'Product Title' -> title", aliased.fieldToColumn.has("title"));
check("alias 'Product Price' -> price", aliased.fieldToColumn.has("price"));
check("alias 'Qty' -> stock", aliased.fieldToColumn.has("stock"));
check("alias 'Image URL' -> images", aliased.fieldToColumn.has("images"));
check("no missing required with aliases", aliased.missingHeaders.length === 0,
  JSON.stringify(aliased.missingHeaders));

const partial = buildHeaderMap(["title", "price"]);
check("missing required reported",
  partial.missingHeaders.includes("stock") && partial.missingHeaders.includes("images"),
  JSON.stringify(partial.missingHeaders));

const withUnknown = buildHeaderMap([...HEADERS, "randomCol"]);
check("unknown header is warning not error",
  withUnknown.unknownHeaders.includes("randomCol") &&
  withUnknown.missingHeaders.length === 0);

console.log("\n== 7. Real workbook round-trip ==");
const sheet = XLSX.utils.aoa_to_sheet([HEADERS, valid]);
const buf = XLSX.write(
  { SheetNames: ["S"], Sheets: { S: sheet } },
  { type: "buffer", bookType: "xlsx" },
);
const parsed = parseWorkbook(buf);
check("headers parsed", parsed.headers[0] === "title" && parsed.headers.length === 16);
check("one data row", parsed.rows.length === 1);
check("rowNumber is 2 (header = row 1)", parsed.rows[0].rowNumber === 2);

const parsedProduct = toProduct(parsed.rows[0].cells);
check("round-trip row is valid", parsedProduct.errors.length === 0,
  JSON.stringify(parsedProduct.errors));
check("round-trip title", parsedProduct.product.title === "Wireless Headphones");

console.log("\n== 8. Export file (empty DB -> template with example row) ==");
const tpl = XLSX.read(buildExportBuffer([]), { type: "buffer" });
check("export has Products sheet", tpl.SheetNames.includes("Products"));
check("export has Instructions sheet", tpl.SheetNames.includes("Instructions"));
const tplHeaders = XLSX.utils.sheet_to_json(tpl.Sheets.Products, { header: 1 })[0];
check("export headers match ProductSchema fields",
  tplHeaders.join(",") === HEADERS.join(","));
check("export has no missing required columns",
  buildHeaderMap(tplHeaders).missingHeaders.length === 0);

console.log("\n== 9. Blank row handling ==");
const blankRow = buildProductFromRow(
  { rowNumber: 5, cells: HEADERS.map(() => "") },
  buildHeaderMap(HEADERS).fieldToColumn,
  () => "X",
);
check("blank row reports all required errors", blankRow.errors.length >= 4,
  JSON.stringify(blankRow.errors));

console.log("\n---------------------------------");
console.log("PASS: " + pass + "   FAIL: " + fail);
console.log("---------------------------------\n");
process.exit(fail ? 1 : 0);
