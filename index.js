require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dbConfig = require("./dbconfig");

const {
  registrationControllers,
  loginControllers,
  forgotPasswordControllers,
  resetPasswordControllers,
  resendVeryficationEmail,
  verifyemailController,
} = require("./controllers/authControllers");
const { rateLimit } = require("express-rate-limit");
const {
  userController,
  getController,
  singleUserController,
  deleteController,
  updateController,
} = require("./controllers/userController");
const app = express();

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

// Order Management

// User Management

app.get("/allusers", getController);
app.get("/singleuserid/:id", singleUserController);
app.delete("/delete/:id", deleteController);
app.post("/update/:id", updateController);

let port = process.env.PORT || 8000;

app.listen(5000, () => {
  console.log(`Server runnig on ${port}`);
});
