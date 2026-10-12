/**
 * Bulk upload controller-এর integration test।
 *
 * এখানে Product model-টি mock করা হয়েছে, যাতে MongoDB ছাড়াই controller-এর
 * আসল আচরণ যাচাই করা যায়: duplicate detection, insertMany, এবং summary।
 *
 * চালাতে: node controllers/bulkProductControllerTest.js
 */
const XLSX = require("xlsx");
const { bulkProductUploadControleer } = require("./bulkProductController");
const Product = require("../models/porductModel");
const { buildExportBuffer } = require("../utils/bulkProductExport");

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

const future = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/** default valid row (object) — override করা যায় */
const row = (over = {}) => {
  const base = {
    title: "Product " + Math.random().toString(36).slice(2, 8),
    sku: "SKU-" + Math.random().toString(36).slice(2, 8),
    shortDescription: "Short",
    description: "Long",
    additionalInfo: "Info",
    price: 1000,
    discountType: "none",
    discount: 0,
    discountStartDate: future(),
    discountEndtDate: future(),
    stock: 5,
    brand: "Brand",
    category: "Cat",
    tag: "a, b",
    status: "active",
    images: "uploads/a.jpg",
  };
  return { ...base, ...over };
};

/** row object থেকে header ক্রমে cell array বানায় */
const toCells = (r) => HEADERS.map((h) => r[h]);

/** rows থেকে xlsx buffer বানায় (row object অথবা cell array দুটোই নেয়) */
const makeWorkbook = (rows, headers = HEADERS) => {
  const aoa = [headers, ...rows.map((r) => (Array.isArray(r) ? r : toCells(r)))];
  return XLSX.write(
    { SheetNames: ["S"], Sheets: { S: XLSX.utils.aoa_to_sheet(aoa) } },
    { type: "buffer", bookType: "xlsx" },
  );
};

// mock DB — controller যা খোঁজে/লেখে ঠিক সেটাই এখানে থাকবে
let db = [];
let insertedBatches = [];

function matches(doc, filter) {
  return Object.entries(filter).every(([field, cond]) => {
    if (cond && typeof cond === "object" && "$in" in cond) {
      return cond.$in.includes(doc[field]);
    }
    return doc[field] === cond;
  });
}

const original = { find: Product.find, insertMany: Product.insertMany };

Product.find = (filter) => ({
  lean: () => Promise.resolve(db.filter((d) => matches(d, filter))),
});

// runValidators অনুযায়ী enum/min মানাচ্ছি, যেমন mongoose করত
Product.insertMany = async (docs, opts) => {
  insertedBatches.push({ docs, opts });
  const saved = [];
  docs.forEach((doc) => {
    const copy = { ...doc };
    const invalid =
      copy.discount < 0 ||
      copy.stock < 0 ||
      !["pending", "active", "inactive"].includes(copy.status);
    if (!invalid) {
      saved.push(copy);
      db.push(copy);
    }
  });
  return saved;
};

/** controller কে mock req/res দিয়ে চালায় */
const runUpload = async (buffer, fileName = "products.xlsx") => {
  const req = { file: { originalname: fileName, buffer, size: buffer.length } };
  let payload = null;
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
    send(data) {
      payload = data;
      return this;
    },
    setHeader() {},
  };
  await bulkProductUploadControleer(req, res);
  return { statusCode, body: payload };
};

(async () => {
  console.log("\n== 1. All-valid file uploads every row ==");
  db = [];
  insertedBatches = [];
  let res = await runUpload(makeWorkbook([row(), row(), row(), row(), row()]));
  check("http 200", res.statusCode === 200);
  check("success true", res.body.success === true);
  check("summary.uploaded = 5", res.body.summary.uploaded === 5,
    JSON.stringify(res.body.summary));
  check("summary.failed = 0", res.body.summary.failed === 0);
  check("summary.totalRows = 5", res.body.summary.totalRows === 5);
  check("5 rows reported", res.body.rows.length === 5);
  check("all rows uploaded", res.body.rows.every((r) => r.status === "uploaded"));
  check("runValidators enabled", insertedBatches[0].opts.runValidators === true);
  check("slug saved on each doc", insertedBatches[0].docs.every((d) => d.slug));
  check("exactly one main image per doc",
    insertedBatches[0].docs.every(
      (d) => d.images.filter((i) => i.isMain).length === 1));

  console.log("\n== 2. Partial failure: valid rows still upload ==");
  db = [];
  insertedBatches = [];
  res = await runUpload(makeWorkbook([
    row({ title: "Good One", price: 500, stock: 3 }),
    row({ title: "Bad Price", price: "abc" }),
    row({ title: "Bad Stock", stock: 0 }),
    row({ title: "Good Two", price: 700, stock: 9 }),
    row({ title: "No Image", images: "" }),
  ]));
  check("uploaded = 2", res.body.summary.uploaded === 2,
    JSON.stringify(res.body.summary));
  check("failed = 3", res.body.summary.failed === 3);
  check("success true on partial", res.body.success === true);
  const failed = res.body.rows.filter((r) => r.status === "failed");
  check("3 failed rows listed", failed.length === 3);
  check("failure row numbers correct",
    failed.map((f) => f.rowNumber).join(",") === "3,4,6",
    failed.map((f) => f.rowNumber).join(","));
  check("price error message",
    failed[0].errors.some((e) => e.includes("price must be a valid number")));
  check("stock error message",
    failed[1].errors.some((e) => e.includes("stock must be greater than 0")));
  check("image error message",
    failed[2].errors.some((e) => e.includes("at least one product image")));

  console.log("\n== 3. Duplicate title already in DB ==");
  db = [{ title: "Already Exists", sku: "OLD-1" }];
  res = await runUpload(makeWorkbook([row({ title: "Already Exists" })]));
  check("uploaded = 0", res.body.summary.uploaded === 0);
  check("failed = 1", res.body.summary.failed === 1);
  check("success false", res.body.success === false);
  check("clear duplicate message",
    res.body.rows[0].errors.includes("a product with this title already exists"),
    JSON.stringify(res.body.rows[0].errors));

  console.log("\n== 4. Duplicate SKU already in DB ==");
  db = [{ title: "Some Other", sku: "TAKEN-SKU" }];
  res = await runUpload(makeWorkbook([row({ sku: "TAKEN-SKU" })]));
  check("uploaded = 0", res.body.summary.uploaded === 0);
  check("clear SKU duplicate message",
    res.body.rows[0].errors.includes("a product with this SKU already exists"),
    JSON.stringify(res.body.rows[0].errors));

  console.log("\n== 5. Duplicate inside the same file ==");
  db = [];
  res = await runUpload(makeWorkbook([
    row({ title: "Same Title", sku: "S1" }),
    row({ title: "Same Title", sku: "S2" }),
  ]));
  check("uploaded = 1", res.body.summary.uploaded === 1);
  check("failed = 1", res.body.summary.failed === 1);
  check("in-file duplicate message",
    res.body.rows[1].errors.includes("duplicate title inside the uploaded file"),
    JSON.stringify(res.body.rows[1].errors));

  console.log("\n== 6. SKU auto-generated when column blank ==");
  db = [];
  res = await runUpload(makeWorkbook([row({ sku: "" })]));
  check("uploaded = 1", res.body.summary.uploaded === 1,
    JSON.stringify(res.body.summary));
  check("auto sku timestamp based",
    /^\d+-\d{4}-\d+$/.test(res.body.rows[0].sku || ""), res.body.rows[0].sku);

  console.log("\n== 7. Missing required column rejected ==");
  db = [];
  res = await runUpload(makeWorkbook([row()], ["title", "price"]));
  check("http 400", res.statusCode === 400);
  check("success false", res.body.success === false);
  check("names missing columns",
    res.body.missingHeaders.includes("stock") &&
    res.body.missingHeaders.includes("images"),
    JSON.stringify(res.body.missingHeaders));

  console.log("\n== 8. Bad file type / unreadable workbook ==");
  db = [];
  res = await runUpload(makeWorkbook([row()]), "products.csv");
  check("http 400 for .csv", res.statusCode === 400);
  check("clear extension message",
    /Only \.xlsx and \.xls/.test(res.body.message), res.body.message);

  res = await runUpload(Buffer.from("not a workbook at all"));
  check("invalid workbook -> http 400", res.statusCode === 400);
  check("read error message shown", !!res.body.message);

  console.log("\n== 9. Empty rows skipped, not failed ==");
  db = [];
  // মাঝে একটা পুরো খালি row — count করা হবে কিন্তু fail হবে না
  res = await runUpload(makeWorkbook([
    row({ title: "Real Product" }),
    Array(HEADERS.length).fill(""),
    row({ title: "Second" }),
  ]));
  check("uploaded = 2", res.body.summary.uploaded === 2,
    JSON.stringify(res.body.summary));
  check("skippedEmpty = 1", res.body.summary.skippedEmpty === 1,
    String(res.body.summary.skippedEmpty));

  console.log("\n== 10. Alias headers work end-to-end ==");
  db = [];
  res = await runUpload(
    makeWorkbook(
      [["My Product", "", "", "", "", "999", "", "", "", "", "7", "", "", "",
        "active", "uploads/x.jpg"]],
      ["Product Title", "SKU", "Short Description", "Description",
        "Additional Info", "Product Price", "Discount Type", "Discount",
        "Discount Start Date", "Discount End Date", "Qty", "Brand", "Category",
        "Tags", "Status", "Image URL"],
    ),
  );
  check("alias headers accepted", res.body.summary.uploaded === 1,
    JSON.stringify(res.body.summary || res.body));

  console.log("\n== 11. Unknown column = warning, not failure ==");
  db = [];
  res = await runUpload(makeWorkbook([row()], [...HEADERS, "Some Extra Col"]));
  check("still uploads", res.body.summary.uploaded === 1);
  check("reported as unknown header",
    res.body.unknownHeaders.includes("Some Extra Col"),
    JSON.stringify(res.body.unknownHeaders));

  console.log("\n== 12. Export is a valid readable xlsx ==");
  check("export has Products sheet",
    XLSX.read(buildExportBuffer([]), { type: "buffer" })
      .SheetNames.includes("Products"));

  // mock restore
  Product.find = original.find;
  Product.insertMany = original.insertMany;

  console.log("\n---------------------------------");
  console.log("PASS: " + pass + "   FAIL: " + fail);
  console.log("---------------------------------\n");
  process.exit(fail ? 1 : 0);
})();
