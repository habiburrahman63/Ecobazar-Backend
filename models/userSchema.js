const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
  },

  email: {
    type: String,
  },
  password: {
    type: String,
  },
  phone: {
    type: String,
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
  postalCode: {
    type: String,
  },
  address: {
    type: String,
  },
  city: {
    type: String,
  },
  billingAddress: {
    fullName: {
      type: String,
    },
    email: {
      type: String,
    },

    street: {
      type: String,
    },

    zipCode: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
  },
});

module.exports = mongoose.model("User", userSchema);
