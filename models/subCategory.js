// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const subCategorySchema = new Schema(
//   {
//     title: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     status: {
//       type: String,
//       enum: ["pending", "approved", "reject"],
//       default: "pending",
//     },
//     category: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Category",
//     },
//   },
//   { timestamps: true },
// );

// module.exports = mongoose.model("SubCategory", subCategorySchema);
