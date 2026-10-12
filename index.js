const dns = require("node:dns/promises");
try {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
} catch (e) {
  console.warn("DNS server setup notice:", e.message);
}

const path = require("path");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dbConfig = require("./dbconfig");
const { rateLimit } = require("express-rate-limit");
const { seedInitialAdmin } = require("./utils/seedAdmin");

// Middlewares
const {
  secureMiddleWare,
  adminMiddleWare,
  optionalAuth,
} = require("./middleWare/secureMiddleWare");

// Controllers
const {
  registrationControleers,
  loginControleers,
  forgotPasswordControleers,
  resetPasswordControleers,
  resendVeryficationEmail,
  verifyemailControleer,
  getMeController,
} = require("./controllers/authControllers");

const {
  adminLoginController,
  getAllAdminsController,
  createAdminController,
  updateAdminController,
  toggleAdminStatusController,
  deleteAdminController,
  changeAdminPasswordController,
  getAdminAuditLogsController,
} = require("./controllers/adminController");

const {
  createProductControleer,
  getProductControleer,
  getSingleProduct,
  productDeleteControleer,
  productUpdateControleer,
  productCatgory,
  getCategory,
  updateCategory,
  deleteCategory,
  deleteProductImageController,
  cleanupOrphanedImagesController,
} = require("./controllers/productController");

const {
  bulkProductUploadControleer,
  bulkProductTemplateControleer,
} = require("./controllers/bulkProductController");
const { MAX_FILE_SIZE } = require("./utils/bulkProductColumns");

const {
  getControleer,
  singleUserControleer,
  deleteControleer,
  updateControleer,
  getAllDeleteUserControleer,
  getSearchData,
} = require("./controllers/userController");

const upload = require("./utils/imageStore");
const { excelUpload } = require("./utils/imageStore");

const {
  createCartControleer,
  increDecreControleer,
  getCartControleer,
  cartDeleteControleer,
  clearCartControleer,
} = require("./controllers/cartController");

const {
  paymentControleer,
  paymentSuccessControleer,
  paymentFailControleer,
  paymentCancelControleer,
  getOrderControleer,
  getAllOrdersControleer,
  updateOrderStatusControleer,
  verifyOrderControleer,
} = require("./controllers/paymentController");

const app = express();

// Rate limiters for security against brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

const compression = require("compression");

// Standard Middlewares
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// High-performance gzip response compression for payloads > 1KB
app.use(
  compression({
    threshold: 1024,
  })
);

// CRITICAL for AamarPay payment callback which sends application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// High-speed static caching for uploaded product media and assets (30 days + immutable)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "30d",
    immutable: true,
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    },
  })
);

// Connect Database & run idempotent admin seed
dbConfig().then(() => {
  seedInitialAdmin().catch((err) => {
    console.error("[Startup Admin Seed Notice]:", err.message);
  });
});

// Root & Health Check Endpoints
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Ecobazar Backend Production API",
    version: "1.0.0",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Ecobazar Backend API",
    time: new Date().toISOString(),
  });
});

// ==========================================
// AUTHENTICATION ROUTES (CUSTOMER)
// ==========================================
app.post("/registration", authLimiter, registrationControleers);
app.post("/login", authLimiter, loginControleers);
app.post("/forgotpassword", forgotPasswordControleers);
app.post("/resetpassword/:token", resetPasswordControleers);
app.post("/resendveryfication", resendVeryficationEmail);
app.post("/verifyemail/:token", verifyemailControleer);
app.get("/me", secureMiddleWare, getMeController);

// ==========================================
// ADMIN AUTHENTICATION & MANAGEMENT (ADMIN ONLY)
// ==========================================
app.post("/admin/login", authLimiter, adminLoginController);
app.get("/admin/list", secureMiddleWare, adminMiddleWare, getAllAdminsController);
app.post("/admin/create", secureMiddleWare, adminMiddleWare, createAdminController);
app.put("/admin/update/:id", secureMiddleWare, adminMiddleWare, updateAdminController);
app.patch(
  "/admin/toggle-status/:id",
  secureMiddleWare,
  adminMiddleWare,
  toggleAdminStatusController
);
app.delete(
  "/admin/delete/:id",
  secureMiddleWare,
  adminMiddleWare,
  deleteAdminController
);
app.post(
  "/admin/change-password",
  secureMiddleWare,
  adminMiddleWare,
  changeAdminPasswordController
);
app.get(
  "/admin/audit-logs",
  secureMiddleWare,
  adminMiddleWare,
  getAdminAuditLogsController
);

// ==========================================
// CATEGORY MANAGEMENT (CRUD)
// ==========================================
app.get("/get-category", getCategory);
app.post("/product-catgory", secureMiddleWare, adminMiddleWare, productCatgory);
app.put("/category/:id", secureMiddleWare, adminMiddleWare, updateCategory);
app.delete("/category/:id", secureMiddleWare, adminMiddleWare, deleteCategory);

// ==========================================
// PRODUCT MANAGEMENT (CRUD)
// ==========================================
app.get("/getallproduct", getProductControleer);
app.get("/getsingleproduct/:id", getSingleProduct);
app.post(
  "/createporduct",
  secureMiddleWare,
  adminMiddleWare,
  upload.array("photos", 5),
  createProductControleer
);
app.put(
  "/getupdate/:id",
  secureMiddleWare,
  adminMiddleWare,
  upload.array("photos", 5),
  productUpdateControleer
);
app.delete(
  "/delete-product/:id",
  secureMiddleWare,
  adminMiddleWare,
  productDeleteControleer
);
// Dedicated image removal and storage synchronization
app.delete(
  "/admin/products/:id/images",
  secureMiddleWare,
  adminMiddleWare,
  deleteProductImageController
);
app.post(
  "/admin/cleanup-orphaned-images",
  secureMiddleWare,
  adminMiddleWare,
  cleanupOrphanedImagesController
);

// Legacy delete routes for backward compatibility
app.delete(
  "/getdelete/:id",
  secureMiddleWare,
  adminMiddleWare,
  productDeleteControleer
);
app.get(
  "/getdelete/:id",
  secureMiddleWare,
  adminMiddleWare,
  productDeleteControleer
);

// ==========================================
// BULK PRODUCT MANAGEMENT (EXCEL)
// ==========================================
app.get(
  "/bulk-product-template",
  secureMiddleWare,
  adminMiddleWare,
  bulkProductTemplateControleer
);
app.post(
  "/bulk-product-upload",
  secureMiddleWare,
  adminMiddleWare,
  excelUpload.single("file"),
  bulkProductUploadControleer
);

// ==========================================
// CART MANAGEMENT
// ==========================================
app.post("/cart/create", optionalAuth, createCartControleer);
app.post("/cart/update/:id", optionalAuth, increDecreControleer);
app.get("/getcart/:userid", optionalAuth, getCartControleer);
app.delete("/deletecart/:id", optionalAuth, cartDeleteControleer);
app.delete("/clearcart/:userid", optionalAuth, clearCartControleer);

// ==========================================
// PAYMENT & ORDER MANAGEMENT
// ==========================================
// Order checkout initiation (Cash on delivery or AamarPay online payment)
app.post("/payment", optionalAuth, paymentControleer);

// AamarPay Webhook / Callback URLs (Called by AamarPay gateway via POST)
app.post("/payment/success", paymentSuccessControleer);
app.post("/payment/fail", paymentFailControleer);
app.post("/payment/cancel", paymentCancelControleer);

// Order Queries & Admin Management
app.get("/getorder/:userid", optionalAuth, getOrderControleer);
app.get("/order/verify/:tranid", verifyOrderControleer);
app.get("/allorders", secureMiddleWare, adminMiddleWare, getAllOrdersControleer);
app.patch(
  "/order/status/:id",
  secureMiddleWare,
  adminMiddleWare,
  updateOrderStatusControleer
);

// ==========================================
// USER MANAGEMENT (ADMIN ONLY)
// ==========================================
app.get("/allusers", secureMiddleWare, adminMiddleWare, getControleer);
app.get("/alldelete", secureMiddleWare, adminMiddleWare, getAllDeleteUserControleer);
app.post("/getsearch", secureMiddleWare, adminMiddleWare, getSearchData);
app.get("/singleuserid/:id", secureMiddleWare, singleUserControleer);
app.delete("/delete/:id", secureMiddleWare, adminMiddleWare, deleteControleer);
app.post("/update/:id", secureMiddleWare, updateControleer);

// Multer error handler
app.use((err, req, res, next) => {
  if (!err || !err.name || !err.name.startsWith("Multer")) {
    return next(err);
  }

  const isSizeLimit = err.code === "LIMIT_FILE_SIZE";
  return res.status(400).json({
    success: false,
    message: isSizeLimit
      ? `File is too large. Maximum size is ${Math.round(
          MAX_FILE_SIZE / (1024 * 1024)
        )} MB.`
      : err.message || "The file could not be uploaded.",
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

const port = process.env.PORT || 5000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Ecobazar Server is running on port ${port}`);
});
