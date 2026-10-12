const multer = require("multer");
const { MAX_FILE_SIZE } = require("./bulkProductColumns");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

/**
 * Bulk upload-এর Excel file আপলোড config।
 *
 * memoryStorage ব্যবহার করা হচ্ছে কারণ ফাইলটি শুধু পড়ে buffer থেকেই data নেওয়া হয় —
 * disk-এ image store করার দরকার নেই। ফলে uploads folder-এ কোনো অবাঞ্ছিত
 * .xlsx ফাইল জমে থাকে না এবং পড়ার পরে স্বয়ংক্রিয়ভাবে memory মুক্ত হয়।
 *
 * fileFilter শুধু .xlsx/.xlsx ফাইল allow করে, আর fileSize limit দিয়ে
 * বড় ফাইলে server ঠিকমতো handle হয়।
 */
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const allowed = [".xlsx", ".xls"];
    const isExcel = allowed.some((ext) => name.endsWith(ext));

    if (isExcel) return cb(null, true);
    return cb(
      new Error("Only .xlsx and .xls Excel files are supported."),
    );
  },
});

module.exports = upload;
module.exports.excelUpload = excelUpload;
