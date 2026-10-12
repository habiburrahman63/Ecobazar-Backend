const User = require("../models/userSchema");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { mailVeryfication, resetPasswordMail } = require("../utils/email");
const { hasEmptyField } = require("../utils/validation");
const { tokenGenerator } = require("../utils/tokenGenerator");

<<<<<<< HEAD
const registrationControleers = async (req, res) => {
  try {
    const { email, password, confirmPassword, name } = req.body;
=======
const registrationControllers = async (req, res) => {
  const { email, password, confirmPassword, name } = req.body;
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37

    if (hasEmptyField(name, email, password, confirmPassword)) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const user = new User({
      email: normalizedEmail,
      password: hash,
      name: name.trim(),
      role: "user",
    });
    await user.save();

    const secret = process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";
    const verificationToken = tokenGenerator(
      { id: user._id, email: user.email },
      secret,
      "1d"
    );

    // Send email asynchronously
    mailVeryfication(verificationToken, normalizedEmail).catch((err) => {
      console.error("Failed to send verification email:", err.message);
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during registration.",
      error: error.message,
    });
  }
<<<<<<< HEAD
=======

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
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
};

const loginControleers = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (hasEmptyField(email, password)) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.isDelete) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated. Contact support.",
      });
    }

    if (user.isHold) {
      return res.status(403).json({
        success: false,
        message: "This account is on hold. Please contact support.",
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";
    const token = tokenGenerator(
      {
        id: user._id,
        _id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      secret,
      "7d"
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token: token,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVeriFied: user.isVeriFied,
        role: user.role,
        isHold: user.isHold,
        phone: user.phone || "",
        address: user.address || "",
        city: user.city || "",
        postalCode: user.postalCode || "",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during login.",
      error: error.message,
    });
  }
<<<<<<< HEAD
=======

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
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
};

const forgotPasswordControleers = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail, isDelete: false });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email address.",
      });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";
    const token = tokenGenerator(
      { id: user._id, email: user.email },
      secret,
      "1h"
    );

    await resetPasswordMail(token, normalizedEmail);

    return res.status(200).json({
      success: true,
      message: "Password reset instructions have been sent to your email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing forgot password request.",
      error: error.message,
    });
  }
};

const resetPasswordControleers = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { token } = req.params;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or has expired.",
      });
    }

    const hash = bcrypt.hashSync(password, 10);
    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      { password: hash },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating password.",
      error: error.message,
    });
  }
};

const resendVeryficationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.isVeriFied) {
      return res.status(400).json({
        success: false,
        message: "This account is already verified.",
      });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";
    const token = tokenGenerator(
      { id: user._id, email: user.email },
      secret,
      "1d"
    );

    await mailVeryfication(token, normalizedEmail);

    return res.status(200).json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending verification email.",
      error: error.message,
    });
  }
};

const verifyemailControleer = async (req, res) => {
  try {
    const { token } = req.params;
    const secret = process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Verification token is invalid or has expired.",
      });
    }

    const findUser = await User.findById(decoded.id);
    if (!findUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (findUser.isVeriFied) {
      return res.status(200).json({
        success: true,
        message: "Account is already verified.",
      });
    }

    findUser.isVeriFied = true;
    await findUser.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({
      success: false,
      message: "Verification failed.",
      error: error.message,
    });
  }
};

const getMeController = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving profile.",
      error: error.message,
    });
  }
};

module.exports = {
  registrationControleers,
  loginControleers,
  forgotPasswordControleers,
  resetPasswordControleers,
  resendVeryficationEmail,
  verifyemailControleer,
  getMeController,
};
