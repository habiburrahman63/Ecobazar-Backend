const dns = require("node:dns/promises");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dbConfig = require("./dbconfig");
const multer = require("multer");

const {
  registrationControllers,
  loginControllers,
  forgotPasswordControllers,
  resetPasswordControllers,
  resendVeryficationEmail,
  verifyemailController,
} = require("./controllers/authControllers");
const {
  createProductController,
  getProductController,
  getSingleProduct,
  productDeleteController,
  productUpdateController,
} = require("./controllers/productController");
const { rateLimit } = require("express-rate-limit");
const {
  userController,
  getController,
  singleUserController,
  deleteController,
  updateController,
} = require("./controllers/userController");
const upload = require("./utils/imageStore");
const {
  createCartController,
  increDecreController,
  getCartController,
  proDeleteController,
  cartDeleteController,
} = require("./controllers/cartController");
const app = express();

// image Stor
// imageStorDoc();

// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 2,
//   standardHeaders: "draft-8",
//   legacyHeaders: false,
//   ipv6Subnet: 56,
// });
// app.use(limiter);

// MiddleWare
app.use(cors());
app.use(express.json());

// Database
dbConfig();

app.post("/ragistration", registrationControllers);
app.post("/login", loginControllers);
app.post("/forgotpassword", forgotPasswordControllers);
app.post("/resetpassword/:token", resetPasswordControllers);
app.post("/resendveryfication", resendVeryficationEmail);
app.post("/verifyemail/:token", verifyemailController);

// Porduct Create
app.post("/createporduct", upload.array("photos", 5), createProductController);
app.get("/getallproduct", getProductController);
app.get("/getsingleproduct/:id", getSingleProduct);
app.get("/getdelete/:id", productDeleteController);
app.post("/getupdate/id", upload.array("photos", 5), productUpdateController);

// Cart Management
app.post("/cart/create", createCartController);
app.post("/cart/update/:id", increDecreController);
app.get("/getcart/:userid", getCartController);
app.delete("/deletecart/:id", cartDeleteController);

// User Management

app.get("/allusers", getController);
app.get("/singleuserid/:id", singleUserController);
app.delete("/delete/:id", deleteController);
app.post("/update/:id", updateController);

let port = process.env.PORT || 8000;

app.listen(5000, () => {
  console.log(`Server runnig on ${port}`);
});
