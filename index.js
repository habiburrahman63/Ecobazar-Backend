require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dbConfig = require("./dbconfig");

const { registrationControllers } = require("./controllers/authControllers");
const app = express();

// MiddleWare
app.use(cors());
app.use(express.json());

// Database
dbConfig();

app.post("/ragistration", registrationControllers);

let port = process.env.PORT || 8000;

app.listen(5000, () => {
  console.log(`Server runnig on ${port}`);
});
