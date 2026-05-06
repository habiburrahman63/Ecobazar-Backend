const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
  fristName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  email: {
    type: String,
  },
  password: {
    type: String,
  },
  phoneNumber: {
    type: String,
  },
  terms: {
    type: Boolean,
  },
  profile: {
    type: String,
  },
  isVeriFied: {
    type: Boolean,
    default: false,
  },
  roll: {
    type: String,
    enum: ["admin", "user", "editore", "vandore"],
    default: "user",
  },
  isHold: {
    type: Boolean,
    default: false,
  },
  billingAddress: {
    fristName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
    },
    companyName: {
      type: String,
    },
    street: {
      type: String,
    },
    state: {
      type: String,
    },
    zipCode: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    country: {
      type: String,
    },
  },
});

module.exports = mongoose.model("User", userSchema);
