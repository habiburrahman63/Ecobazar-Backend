const mongoose = require("mongoose");

const dbConfig = async () => {
  try {
    const rawUri =
      process.env.MONGODB_URL ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      "";
    const mongoUri = rawUri.trim();
    if (!mongoUri) {
      console.error("MongoDB connection error: MONGODB_URL / MONGODB_URI is not defined in .env");
      return;
    }

    await mongoose.connect(mongoUri);
    console.log("Database Connected Successfully");
  } catch (error) {
    console.error("Database Connection Failed:", error.message);
  }
};

mongoose.connection.on("disconnected", () => {
  console.log("Database connection lost. Reconnecting...");
});

module.exports = dbConfig;
