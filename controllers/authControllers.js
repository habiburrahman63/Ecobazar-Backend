const User = require("../models/userSchema");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { mailVeryfication, resetPasswordMail } = require("../utils/email");
const { emptyfieldValidation } = require("../utils/validation");
const { tokenGenerator } = require("../utils/tokenGenerator");
const { existingData } = require("../utils/existingData");

const registrationControllers = async (req, res) => {
  const { email, password, confirmPassword, name } = req.body;

  // existingData
  // let users = await existingData({ res, email: email });
  let users = await User.findOne({ email: email });

  if (users) {
    return res.send({
      success: false,
      message: "User Exist",
    });
  }

  // emptyFieldValidation

  emptyfieldValidation(res, email, password, confirmPassword);

  if (password !== confirmPassword) {
    return res.send({
      success: false,
      message: "password not matched",
    });
  }

  const hash = bcrypt.hashSync(password, 10);

  let user = new User({
    email: email,
    password: hash,
    name: name,
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

  res.send({
    success: true,
    message:
      "Registrition Successfull Please check your email for verification ",
  });
};

const loginControllers = async (req, res) => {
  const { email, password } = req.body;

  // let users = await existingData({ res, email: email });
  let users = await User.findOne({ email: email });

  if (!users) {
    return res.send({
      success: false,
      message: "User Not Fount",
    });
  }

  emptyfieldValidation(res, email, password);

  let pass = bcrypt.compareSync(password, users.password);

  if (!pass) {
    return res.send({
      success: false,
      message: "Invalid Credential",
    });
  }
  res.send({
    success: true,
    message: "Login Successfully Done",
    data: {
      _id: users._id,
      name: users.name,
      email: users.email,
      isVeriFied: users.isVeriFied,
      roll: users.roll,
      isHold: users.isHold,
    },
  });
};

const forgotPasswordControllers = async (req, res) => {
  const { email } = req.body;

  emptyfieldValidation(res, email);

  // let users = await existingData({ res, email: email });
  let users = await User.findOne({ email: email });

  if (!users) {
    return res.send({
      success: false,
      message: "Email Not Fount",
    });
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

  res.send({
    success: true,
    message: "Please Check your Email",
  });
};

const resetPasswordControllers = async (req, res) => {
  let { newPassword, confirmPassword } = req.body;
  let { token } = req.params;

  if (newPassword !== confirmPassword) {
    return res.send({
      success: false,
      message: "Confirm Password not Matched",
    });
  }

  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET,
    async function (err, decoded) {
      console.log(err);
      if (err) {
        res.send({
          success: false,
          message: "Unauthorized",
        });
      } else {
        const hash = bcrypt.hashSync(newPassword, 10);
        let updateData = await User.findByIdAndUpdate(
          { _id: decoded.id },
          { password: hash },
          { new: true },
        );
        res.send({
          success: true,
          message: "password Updated",
          updateData,
        });
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

  res.send({
    success: true,
    message: "Chack your email for Veryfication",
  });
};

let verifyemailController = async (req, res) => {
  const { token } = req.params;

  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET,
    async function (err, decoded) {
      if (err) {
        res.send({
          success: true,
          message: "Unauthorized",
        });
      } else {
        const userId = decoded.id;
        let findUser = await User.findById(userId);

        if (findUser.isVeriFied) {
          return res.send({ message: "user already VeriFied" });
        } else {
          findUser.isVeriFied = true;
          findUser.save();
          res.send({
            success: true,
            message: "Email Verifyed Successfully Done",
          });
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
