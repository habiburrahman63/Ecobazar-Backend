const User = require("../models/userSchema");

const { mailVeryfication } = require("../utils/email");
const { emptyfieldValidation } = require("../utils/validation");
const { tokenGenerator } = require("../utils/tokenGenerator");
const { existingData } = require("../utils/existingData");

const registrationControllers = async (req, res) => {
  const { email, password, confirmPassword, terms } = req.body;

  // existingData
  let users = await existingData({ res, email: email });

  if (users) {
    return;
  }

  if (!terms) {
    return res.send({ message: "please Accept our terms and condition" });
  }

  // emptyFieldValidation

  emptyfieldValidation(res, email, password, confirmPassword, terms);

  if (password !== confirmPassword) {
    return res.send({ message: "password not matched" });
  }

  let user = new User({
    email: email,
    password: password,
    terms: terms,
  });
  await user.save();

  // tokenGenerator

  let token = tokenGenerator(
    {
      id: user._id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    "1d",
  );

  mailVeryfication(token, email);

  res.send({ message: "Registrition Successfully Done" });
};

module.exports = { registrationControllers };
