const User = require("../models/userSchema");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { mailVeryfication, resetPasswordMail } = require("../utils/email");
const { emptyfieldValidation } = require("../utils/validation");
const { tokenGenerator } = require("../utils/tokenGenerator");
const { existingData } = require("../utils/existingData");

const registrationControllers = async (req, res) => {
  const { email, password, confirmPassword, terms } = req.body;

  // existingData
  // let users = await existingData({ res, email: email });
  let users = await User.findOne({ email: email });

  if (users) {
    return res.send({ message: "User Exist" });
  }

  if (!terms) {
    return res.send({ message: "please Accept our terms and condition" });
  }

  // emptyFieldValidation

  emptyfieldValidation(res, email, password, confirmPassword, terms);

  if (password !== confirmPassword) {
    return res.send({ message: "password not matched" });
  }

  const hash = bcrypt.hashSync(password, 10);

  let user = new User({
    email: email,
    password: hash,
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

const loginControllers = async (req, res) => {
  const { email, password } = req.body;

  // let users = await existingData({ res, email: email });
  let users = await User.findOne({ email: email });

  if (!users) {
    return res.send({ message: "User Not Fount" });
  }

  emptyfieldValidation(res, email, password);

  let pass = bcrypt.compareSync(password, users.password);

  if (!pass) {
    return res.send({ message: "Invalid Credential" });
  }
  res.send({ message: "Login Successfully Done" });
};

const forgotPasswordControllers = async (req, res) => {
  const { email } = req.body;

  emptyfieldValidation(res, email);

  // let users = await existingData({ res, email: email });
  let users = await User.findOne({ email: email });

  if (!users) {
    return res.send({ message: "Email Not Fount" });
  }

  let token = tokenGenerator(
    {
      id: users._id,
      email: users.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    "1d",
  );

  resetPasswordMail(token, email);

  res.send({ message: "Please Check your Email" });
};

const resetPasswordControllers = async (req, res) => {
  let { newPassword, confirmPassword } = req.body;
  let { token } = req.params;

  if (newPassword !== confirmPassword) {
    return res.send({ message: "Confirm Password not Matched" });
  }

  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET,
    async function (err, decoded) {
      console.log(err);
      if (err) {
        res.send({ message: "Unauthorized" });
      } else {
        const hash = bcrypt.hashSync(newPassword, 10);
        let updateData = await User.findByIdAndUpdate(
          { _id: decoded.id },
          { password: hash },
          { new: true },
        );
        res.send({ message: "password Updated", updateData });
      }
    },
  );
};

const resendVeryficationEmail = async (req, res) => {
  let { email } = req.body;
  let user = await User.findOne({ email: email });
  let token = tokenGenerator(
    {
      id: user._id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    "1d",
  );
  mailVeryfication(token, email);

  res.send({ message: "Chack your email for Veryfication" });
};

let verifyemailController = async (req, res) => {
  const { token } = req.params;

  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET,
    async function (err, decoded) {
      if (err) {
        res.send({ message: "Unauthorized" });
      } else {
        const userId = decoded.id;
        let findUser = await User.findById(userId);

        if (findUser.isVeriFied) {
          return res.send({ message: "user already isVeriFied" });
        } else {
          findUser.isVeriFied = true;
          findUser.save();
          res.send({ message: "Email Verifyed Successfully Done" });
        }
      }
    },
  );
};

module.exports = {
  registrationControllers,
  loginControllers,
  forgotPasswordControllers,
  resetPasswordControllers,
  resendVeryficationEmail,
  verifyemailController,
};
