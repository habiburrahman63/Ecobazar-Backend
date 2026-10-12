/**
 * Bulk Product Upload — Excel workbook পড়া ও header mapping।
 *
 * xlsx .xlsx ও .xls দুটোই পড়তে পারে, তাই admin যে কোনো দুটোই upload করতে পারবে।
 */

const XLSX = require("xlsx");
const {
  HEADER_LOOKUP,
  REQUIRED_HEADERS,
  normalizeKey,
} = require("./bulkProductColumns");

/**
 * Excel buffer পড়ে header list ও data rows বের করে।
 *
 * @returns {{ headers:string[], rows:Array<{rowNumber:number,cells:any[]}>, sheetName:string }}
 * @throws {Error} ফাইল পড়া গেলে না / খালি হলে, user দেখানোর মতো message সহ
 */
const parseWorkbook = (buffer) => {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch (err) {
    throw new Error(
      "The file could not be read. Please make sure it is a valid .xlsx or .xls file.",
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The Excel file is empty");

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: true,
    cellDates: true,
    blankrows: false,
  });

  if (!matrix.length) throw new Error("The Excel file is empty");

  const headers = matrix[0].map((h) => (h === null ? "" : String(h).trim()));

  if (headers.every((h) => h === "")) {
    throw new Error(
      "The first row must contain column headers matching the ProductSchema fields.",
    );
  }

  const rows = matrix.slice(1).map((cells, index) => ({
    // header row = row 1, তাই data row 2 থেকে শুরু
    rowNumber: index + 2,
    cells,
  }));

  return { headers, rows, sheetName };
};

/**
 * Header list থেকে column index -> schema field map বানায়।
 *
 * - পরিচিত না header গুলো unknown হিসেবে জমা হয় (warning, error নয়)
 * - required column না থাকলে missingHeaders-এ ধরা পড়ে, controller সেটা
 *   ব্যবহার করে admin-কে clear message দেখাবে
 */
const buildHeaderMap = (headers) => {
  const fieldToColumn = new Map();
  const unknownHeaders = [];

  headers.forEach((header, index) => {
    const def = HEADER_LOOKUP[normalizeKey(header)];
    if (!def) {
      if (header !== "") unknownHeaders.push(header);
      return;
    }
    // একই field দুইবার থাকলে প্রথম column-টি ব্যবহার হবে
    if (!fieldToColumn.has(def.field)) fieldToColumn.set(def.field, index);
  });

  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !fieldToColumn.has(HEADER_LOOKUP[normalizeKey(header)].field),
  );

  return { fieldToColumn, unknownHeaders, missingHeaders };
};

module.exports = { parseWorkbook, buildHeaderMap };
