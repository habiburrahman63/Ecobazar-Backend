const User = require("../models/userSchema");

const existingData = async (res, ...findData) => {
  let existingUser = await User.findOne({ findData });

  if (existingUser) {
    // res.send({ message: "User already axists" });

    return true;
  } else {
    return false;
  }
};

module.exports = { existingData };
