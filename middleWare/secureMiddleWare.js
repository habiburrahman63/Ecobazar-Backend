const jwt = require("jsonwebtoken");
const User = require("../models/userSchema");

const extractToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) return null;
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return header.trim();
};

const secureMiddleWare = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";
    const decoded = jwt.verify(token, secret);

    // Verify user exists and is not deleted or on hold
    const user = await User.findById(decoded.id || decoded._id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found or account no longer exists.",
      });
    }

    if (user.isDelete) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated.",
      });
    }

    if (user.isHold) {
      return res.status(403).json({
        success: false,
        message: "Account is on hold. Please contact support.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
      error: error.message,
    });
  }
};

const adminMiddleWare = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Authentication required.",
    });
  }

  const role = req.user.role;
  if (role === "admin" || role === "manager") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Forbidden: Admin privileges required.",
  });
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }
    const secret = process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id || decoded._id).select("-password");
    if (user && !user.isDelete) {
      req.user = user;
    }
  } catch {
    // optional, proceed as guest
  }
  next();
};

module.exports = secureMiddleWare;
module.exports.secureMiddleWare = secureMiddleWare;
module.exports.adminMiddleWare = adminMiddleWare;
module.exports.optionalAuth = optionalAuth;
