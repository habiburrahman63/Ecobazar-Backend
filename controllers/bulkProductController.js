/**
 * Bulk Product Upload controller।
 *
 * Flow: Excel -> parse -> header map -> row-wise ProductSchema validation ->
 * DB duplicate check -> insertMany -> summary (কতটা upload হলো / কোনগুলো fail)।
 *
 * গুরুত্বপূর্ণ: একটি row invalid হলে শুধু ওই row বাদ পড়ে, বাকি rows আপলোড হয় —
 * তাই admin কখনো silently সবকিছু হারায় না, আর কখনো সব fail হয়েও বুঝতে পারে।
 */

const Product = require("../models/porductModel");
const {
  MAX_UPLOAD_ROWS,
} = require("../utils/bulkProductColumns");
const {
  parseWorkbook,
  buildHeaderMap,
} = require("../utils/bulkProductWorkbook");
const { buildProductFromRow } = require("../utils/bulkProductRow");
const { buildExportBuffer } = require("../utils/bulkProductExport");

/** একসাথে DB-তে duplicate খোঁজার জন্য safe chunk size (Mongo query limit) */
const DB_LOOKUP_CHUNK = 500;

/** MongoDB duplicate key error (title/slug/sku unique index violation) */
const isDuplicateKeyError = (err) => err && err.code === 11000;

/**
 * mongoose ValidationError থেকে আস্তে-সুস্পষ্ট field-wise message বানায়।
 * bulk-তে row-level report দেখাতে হয়, তাই generic "Server Error" যথেষ্ট নয়।
 */
const formatValidationError = (err) => {
  if (!err || err.name !== "ValidationError" || !err.errors) return "Invalid product data";
  return Object.values(err.errors)
    .map((fieldError) => fieldError.message)
    .join(", ");
};

/**
 * DB-তে আগে থেকে থাকা title/SKU খুঁজে বের করে।
 * এতে একটি query-এ হাজার হাজার row check করা যায় (per-row query এড়ানো হয়)।
 */
const findExistingKeys = async (documents) => {
  const titles = documents.map((d) => d.document.title).filter(Boolean);
  const skus = documents.map((d) => d.document.sku).filter(Boolean);

  const existingTitles = new Set();
  const existingSkus = new Set();

  // বড় ফাইলে $in query সীমা ছাড়াতে chunk করে খোঁজা হয়
  for (let i = 0; i < titles.length; i += DB_LOOKUP_CHUNK) {
    const chunk = titles.slice(i, i + DB_LOOKUP_CHUNK);
    const found = await Product.find(
      { title: { $in: chunk } },
      { title: 1, _id: 0 },
    ).lean();
    found.forEach((item) => existingTitles.add(item.title));
  }

  for (let i = 0; i < skus.length; i += DB_LOOKUP_CHUNK) {
    const chunk = skus.slice(i, i + DB_LOOKUP_CHUNK);
    const found = await Product.find(
      { sku: { $in: chunk } },
      { sku: 1, _id: 0 },
    ).lean();
    found.forEach((item) => existingSkus.add(item.sku));
  }

  return { existingTitles, existingSkus };
};

/**
 * একটি ফাইলের সব row process করে valid document ও row report আলাদা করে।
 * ফাইলের ভেতরের duplicate title/SKU এখানেই ধরা পড়ে।
 *
 * @returns {{ documents:Array, rowResults:Array, skippedEmpty:number }}
 */
const buildProductsFromRows = ({ rows, fieldToColumn }) => {
  const documents = [];
  const rowResults = [];
  const seenTitles = new Set();
  const seenSkus = new Set();
  let skuCounter = 1;
  let skippedEmpty = 0;

  /** failed row report helper */
  const fail = (rowNumber, title, sku, error) => {
    rowResults.push({
      rowNumber,
      title: title || "",
      sku,
      status: "failed",
      errors: [error],
    });
  };

  rows.forEach((row) => {
    // পুরো খালি row বাদ দেওয়া হয় (Excel-এ মাঝে মাঝে blank line থাকে)
    if (row.cells.every((value) => isEmptyCell(value))) {
      skippedEmpty += 1;
      return;
    }

    // SKU না দিলে create API-র মতো timestamp SKU generate হয়, কিন্তু একই
    // millisecond-এ হলে index মিশিয়ে সবসময় unique রাখা হয়।
    const skuFactory = () =>
      `${Date.now()}-${new Date().getFullYear()}-${skuCounter++}`;

    const result = buildProductFromRow(row, fieldToColumn, skuFactory);

    if (result.errors.length) {
      rowResults.push({
        rowNumber: row.rowNumber,
        title: result.title,
        sku: result.sku,
        status: "failed",
        errors: result.errors,
      });
      return;
    }

    // --- ফাইলের ভেতরেই duplicate ধরা ---
    const titleKey = result.product.title.toLowerCase();
    if (seenTitles.has(titleKey)) {
      fail(row.rowNumber, result.title, result.product.sku,
        "duplicate title inside the uploaded file");
      return;
    }
    if (seenSkus.has(result.product.sku)) {
      fail(row.rowNumber, result.title, result.product.sku,
        "duplicate SKU inside the uploaded file");
      return;
    }

    seenTitles.add(titleKey);
    seenSkus.add(result.product.sku);

    documents.push({ rowNumber: row.rowNumber, document: result.product });
    rowResults.push({
      rowNumber: row.rowNumber,
      title: result.title,
      sku: result.product.sku,
      status: "pending",
      errors: [],
    });
  });

  return { documents, rowResults, skippedEmpty };
};

/** cell খালি কিনা (0/false খালি নয়) */
function isEmptyCell(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

/**
 * BULK PRODUCT UPLOAD
 *
 * multipart/form-data, field name: "file" (single .xlsx / .xls)
 *
 * Response: { success, summary: {...}, rows: [...] }
 * যেখানে প্রতিটি row-এর rowNumber, title, sku, status ও error থাকে।
 */
const bulkProductUploadControleer = async (req, res) => {
  // ---------- file check ----------
  const file = req.file;
  if (!file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded. Please select an .xlsx or .xls file.",
    });
  }

  const extension = (file.originalname || "").toLowerCase();
  if (!extension.endsWith(".xlsx") && !extension.endsWith(".xls")) {
    return res.status(400).json({
      success: false,
      message: "Only .xlsx and .xls Excel files are supported.",
    });
  }

  try {
    // ---------- 1. workbook পড়া ----------
    let parsed;
    try {
      parsed = parseWorkbook(file.buffer);
    } catch (parseError) {
      return res.status(400).json({ success: false, message: parseError.message });
    }

    // ---------- 2. header -> schema field mapping ----------
    const { fieldToColumn, unknownHeaders, missingHeaders } = buildHeaderMap(
      parsed.headers,
    );

    // required column না থাকলে পুরো ফাইল গ্রহণযোগ্য নয় — কারণ প্রতিটি row-এ
    // ওই field লাগবেই। তাই এখানে পরিষ্কারভাবে জানানো হচ্ছে।
    if (missingHeaders.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required column(s): ${missingHeaders.join(", ")}. Download the template for the correct format.`,
        missingHeaders,
      });
    }

    // ---------- 3. row limit ----------
    const rowsWithData = parsed.rows.filter((r) => !r.cells.every(isEmptyCell));
    if (rowsWithData.length > MAX_UPLOAD_ROWS) {
      return res.status(400).json({
        success: false,
        message: `Too many rows: ${rowsWithData.length}. A maximum of ${MAX_UPLOAD_ROWS} products can be uploaded at once.`,
      });
    }

    // ---------- 4. row-wise validation ----------
    const { documents, rowResults, skippedEmpty } = buildProductsFromRows({
      rows: parsed.rows,
      fieldToColumn,
    });

    if (!documents.length && !rowResults.length) {
      return res.status(400).json({
        success: false,
        message:
          "No product rows were found. Keep the header row and add at least one product.",
      });
    }

    // ---------- 5. DB duplicate check (title/SKU) ----------
    const { existingTitles, existingSkus } = await findExistingKeys(documents);

    const insertable = [];
    documents.forEach((entry) => {
      const { document } = entry;
      const result = rowResults.find((r) => r.rowNumber === entry.rowNumber);
      if (existingTitles.has(document.title)) {
        result.status = "failed";
        result.errors = ["a product with this title already exists"];
        return;
      }
      if (existingSkus.has(document.sku)) {
        result.status = "failed";
        result.errors = ["a product with this SKU already exists"];
        return;
      }
      insertable.push(entry);
    });

    // ---------- 6. insert (schema validation সহ) ----------
    let insertedDocs = [];
    if (insertable.length) {
      try {
        // runValidators: true দিলে ProductSchema-র enum/min ইত্যাদি
        // validation insertMany-তেও চলে — কোনো rule bypass হয় না।
        insertedDocs = await Product.insertMany(
          insertable.map((entry) => entry.document),
          { ordered: false, runValidators: true },
        );
      } catch (dbError) {
        // Mongo duplicate key race বা validation error — row-wise report করা হয়
        const writeErrors =
          (dbError && dbError.writeErrors) ||
          (dbError && dbError.writeConcernError ? [dbError.writeConcernError] : []);

        if (!writeErrors.length && !isDuplicateKeyError(dbError)) throw dbError;

        // ordered:false হওয়ায় বাকি row গুলো DB-তে ঢুকে গেছে; শুধু যেগুলো
        // fail করেছে সেগুলো row report-এ বাদ দেওয়া হচ্ছে।
        writeErrors.forEach((writeError) => {
          const entry = insertable[writeError.index];
          if (!entry) return;
          const result = rowResults.find((r) => r.rowNumber === entry.rowNumber);
          if (!result) return;
          result.status = "failed";
          result.errors = [
            isDuplicateKeyError(writeError.err) || writeError.err?.code === 11000
              ? "a product with this title or SKU already exists"
              : formatValidationError(writeError.err),
          ];
        });
      }
    }

    // insertMany সফল হলে প্রতিটি row-কে "uploaded" চিহ্নিত করা হয়
    if (insertedDocs.length) {
      const insertedBySku = new Set(insertedDocs.map((doc) => doc.sku));
      rowResults.forEach((result) => {
        if (result.status === "pending" && insertedBySku.has(result.sku)) {
          result.status = "uploaded";
        }
      });
    }

    // ---------- 7. summary ----------
    const uploaded = rowResults.filter((r) => r.status === "uploaded").length;
    const failedResults = rowResults.filter((r) => r.status === "failed");
    const totalRows = uploaded + failedResults.length;

    return res.json({
      success: uploaded > 0,
      message:
        uploaded > 0
          ? `${uploaded} of ${totalRows} product(s) uploaded successfully.`
          : "No products were uploaded. Please fix the errors below and try again.",
      summary: {
        totalRows,
        uploaded,
        failed: failedResults.length,
        skippedEmpty,
        fileName: file.originalname,
      },
      // পরিচিত না column শুধু warning — fail নয়
      unknownHeaders,
      rows: rowResults,
    });
  } catch (error) {
    console.error("Bulk product upload error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server Error" });
  }
};

/**
 * DOWNLOAD TEMPLATE / EXPORT
 *
 * Database-এ থাকা সব Product-এর data একটি .xlsx file হিসেবে পাঠায়।
 *
 * ফাইলটি এমনভাবে বানানো যাতে সরাসরি Bulk Upload-এ আবার ব্যবহার করা যায় —
 * column header হুবহু ProductSchema-র field name, এবং প্রতিটি মান সেই
 * রূপেই লেখা হয় যা upload parser আবার পড়তে পারে (দেখুন utils/bulkProductExport.js)।
 *
 * Database খালি হলে একই ফাইলে example row-সহ ফাঁকা template পাওয়া যায়,
 * তাই admin চাইলে সেটা দিয়েই নতুন product তৈরি করতে পারে।
 */
const bulkProductTemplateControleer = async (req, res) => {
  try {
    // .lean() দিয়ে পড়া হচ্ছে কারণ এখানে document mutate করার দরকার নেই —
    // বড় dataset-এ এটি অনেক দ্রুত ও কম memory-hungry।
    const products = await Product.find({})
      .sort({ createdAt: 1 })
      .lean();

    const buffer = buildExportBuffer(products);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    // filename-এ date যোগ করা হচ্ছে যাতে একাধিক download করলে ফাইলগুলো
    // গুলিয়ে না যায়।
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="products-export-${stamp}.xlsx"`,
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Product export error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not export the products" });
  }
};

module.exports = {
  bulkProductUploadControleer,
  bulkProductTemplateControleer,
};
