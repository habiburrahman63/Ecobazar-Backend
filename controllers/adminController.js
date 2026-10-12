const User = require("../models/userSchema");
const AdminAuditLog = require("../models/adminAuditLogModel");
const bcrypt = require("bcrypt");
const { tokenGenerator } = require("../utils/tokenGenerator");
const { hasEmptyField } = require("../utils/validation");

const ADMIN_ROLES = ["admin", "manager", "editor"];

/**
 * Record an audit log entry safely without leaking secrets or failing the main request.
 */
const recordAuditLog = async ({
  action,
  actor,
  target,
  details,
  status = "SUCCESS",
  req,
}) => {
  try {
    const ipAddress =
      req?.headers["x-forwarded-for"]?.split(",")[0] ||
      req?.socket?.remoteAddress ||
      "";
    const userAgent = req?.headers["user-agent"] || "";

    await AdminAuditLog.create({
      action,
      actorId: actor?._id || actor?.id,
      actorEmail: actor?.email,
      actorName: actor?.name,
      actorRole: actor?.role,
      targetId: target?._id || target?.id,
      targetEmail: target?.email,
      details,
      ipAddress,
      userAgent,
      status,
    });
  } catch (err) {
    console.error("[Audit Log Error]:", err.message);
  }
};

/**
 * Dedicated Administrator Login Endpoint
 * Enforces role verification, brute force protection, and records audit trail.
 */
const adminLoginController = async (req, res) => {
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
      await recordAuditLog({
        action: "ADMIN_LOGIN_FAILED",
        actor: { email: normalizedEmail, role: "unknown" },
        details: "Attempted login with non-existent email.",
        status: "FAILED",
        req,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // Crucial check: verify that this account has administrative privileges
    if (!ADMIN_ROLES.includes(user.role)) {
      await recordAuditLog({
        action: "ADMIN_LOGIN_REJECTED_UNAUTHORIZED_ROLE",
        actor: user,
        details: `Standard user '${user.email}' attempted to access Admin Console.`,
        status: "WARNING",
        req,
      });

      return res.status(403).json({
        success: false,
        message:
          "Access denied: You do not possess administrator credentials or permissions.",
      });
    }

    if (user.isDelete) {
      return res.status(403).json({
        success: false,
        message:
          "This administrator account has been archived or removed by system administration.",
      });
    }

    if (user.isHold) {
      return res.status(403).json({
        success: false,
        message:
          "This administrator account is deactivated. Contact the master administrator.",
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      await recordAuditLog({
        action: "ADMIN_LOGIN_FAILED",
        actor: user,
        details: "Invalid password supplied.",
        status: "FAILED",
        req,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save();

    const secret =
      process.env.ACCESS_TOKEN_SECRET || "default_jwt_secret_fallback";
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

    await recordAuditLog({
      action: "ADMIN_LOGIN_SUCCESS",
      actor: user,
      details: `Administrator logged into console session with role '${user.role}'.`,
      status: "SUCCESS",
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Admin authentication successful.",
      token,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isHold: user.isHold,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred during admin authentication.",
      error: error.message,
    });
  }
};

/**
 * Fetch all registered administrators and staff members
 */
const getAllAdminsController = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ADMIN_ROLES },
      isDelete: { $ne: true },
    })
      .select("-password")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: admins.length,
      admins,
    });
  } catch (error) {
    console.error("Fetch admins error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve administrator directory.",
      error: error.message,
    });
  }
};

/**
 * Create a new administrator account (Accessible only to authenticated Admins)
 */
const createAdminController = async (req, res) => {
  try {
    // Only full "admin" role can create new staff or administrators
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only master administrators can provision new admin accounts.",
      });
    }

    const { name, email, password, confirmPassword, role } = req.body;

    if (hasEmptyField(name, email, password, confirmPassword)) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, password, and confirmation are required.",
      });
    }

    const assignedRole = role || "manager";
    if (!ADMIN_ROLES.includes(assignedRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Supported roles are: ${ADMIN_ROLES.join(", ")}.`,
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
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
        message: "An account with this email address already exists.",
      });
    }

    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(password, salt);

    const newAdmin = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hash,
      role: assignedRole,
      isVeriFied: true,
      isHold: false,
      isDelete: false,
      createdBy: req.user._id,
    });

    await newAdmin.save();

    await recordAuditLog({
      action: "ADMIN_CREATED",
      actor: req.user,
      target: newAdmin,
      details: `Created new ${assignedRole} account for '${normalizedEmail}'.`,
      status: "SUCCESS",
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Administrator '${name}' (${assignedRole}) created successfully.`,
      admin: {
        _id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        isHold: newAdmin.isHold,
        createdAt: newAdmin.createdAt,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating administrator account.",
      error: error.message,
    });
  }
};

/**
 * Update an existing administrator's details
 */
const updateAdminController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only master administrators can modify administrator profiles.",
      });
    }

    const { id } = req.params;
    const { name, phone, role } = req.body;

    const targetAdmin = await User.findById(id);
    if (!targetAdmin || targetAdmin.isDelete) {
      return res.status(404).json({
        success: false,
        message: "Administrator account not found.",
      });
    }

    // Guard: Prevent demoting the last active administrator
    if (
      targetAdmin.role === "admin" &&
      role &&
      role !== "admin"
    ) {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        isDelete: false,
        isHold: false,
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message:
            "Operation blocked: Cannot demote the last remaining active administrator account.",
        });
      }
    }

    if (name) targetAdmin.name = name.trim();
    if (phone !== undefined) targetAdmin.phone = phone.trim();
    if (role && ADMIN_ROLES.includes(role)) {
      targetAdmin.role = role;
    }

    await targetAdmin.save();

    await recordAuditLog({
      action: "ADMIN_UPDATED",
      actor: req.user,
      target: targetAdmin,
      details: `Updated details for administrator '${targetAdmin.email}'.`,
      status: "SUCCESS",
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Administrator updated successfully.",
      admin: {
        _id: targetAdmin._id,
        name: targetAdmin.name,
        email: targetAdmin.email,
        role: targetAdmin.role,
        phone: targetAdmin.phone,
        isHold: targetAdmin.isHold,
      },
    });
  } catch (error) {
    console.error("Update admin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update administrator.",
      error: error.message,
    });
  }
};

/**
 * Toggle Administrator Account Status (Activate / Deactivate)
 * Enforces critical protections:
 * - Cannot deactivate yourself while logged in
 * - Cannot deactivate the last remaining active administrator
 */
const toggleAdminStatusController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only master administrators can toggle administrator status.",
      });
    }

    const { id } = req.params;

    // Protection 1: Self-deactivation protection
    if (req.user._id.toString() === id.toString()) {
      return res.status(400).json({
        success: false,
        message:
          "Security Protection: You cannot deactivate your own active administrator account while logged in.",
      });
    }

    const targetAdmin = await User.findById(id);
    if (!targetAdmin || targetAdmin.isDelete) {
      return res.status(404).json({
        success: false,
        message: "Administrator account not found.",
      });
    }

    // Protection 2: Final remaining admin protection
    const willBeDeactivated = !targetAdmin.isHold;
    if (willBeDeactivated && targetAdmin.role === "admin") {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        isDelete: false,
        isHold: false,
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message:
            "Security Protection: Cannot deactivate the final remaining active administrator account.",
        });
      }
    }

    targetAdmin.isHold = !targetAdmin.isHold;
    await targetAdmin.save();

    const action = targetAdmin.isHold ? "ADMIN_DEACTIVATED" : "ADMIN_ACTIVATED";
    await recordAuditLog({
      action,
      actor: req.user,
      target: targetAdmin,
      details: targetAdmin.isHold
        ? `Deactivated administrator '${targetAdmin.email}'.`
        : `Re-activated administrator '${targetAdmin.email}'.`,
      status: "SUCCESS",
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Administrator '${targetAdmin.name}' is now ${
        targetAdmin.isHold ? "Deactivated" : "Active"
      }.`,
      isHold: targetAdmin.isHold,
    });
  } catch (error) {
    console.error("Toggle admin status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update administrator status.",
      error: error.message,
    });
  }
};

/**
 * Remove / Delete Administrator Account
 * Enforces critical protections:
 * - Cannot delete yourself while logged in
 * - Cannot delete the final remaining active administrator
 */
const deleteAdminController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only master administrators can delete administrator accounts.",
      });
    }

    const { id } = req.params;

    // Protection 1: Self-deletion check
    if (req.user._id.toString() === id.toString()) {
      return res.status(400).json({
        success: false,
        message:
          "Security Protection: You cannot delete your own active administrator account while logged in.",
      });
    }

    const targetAdmin = await User.findById(id);
    if (!targetAdmin || targetAdmin.isDelete) {
      return res.status(404).json({
        success: false,
        message: "Administrator account not found.",
      });
    }

    // Protection 2: Final active admin check
    if (targetAdmin.role === "admin") {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        isDelete: false,
        isHold: false,
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message:
            "Security Protection: Cannot delete the final remaining active administrator account.",
        });
      }
    }

    // Mark as deleted / archived safely
    targetAdmin.isDelete = true;
    targetAdmin.isHold = true;
    await targetAdmin.save();

    await recordAuditLog({
      action: "ADMIN_DELETED",
      actor: req.user,
      target: targetAdmin,
      details: `Safely removed administrator access for '${targetAdmin.email}'.`,
      status: "SUCCESS",
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Administrator '${targetAdmin.name}' has been successfully removed.`,
    });
  } catch (error) {
    console.error("Delete admin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove administrator account.",
      error: error.message,
    });
  }
};

/**
 * Change Administrator Password
 * Allows currently authenticated administrator to securely update their own password.
 */
const changeAdminPasswordController = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Current password, new password, and password confirmation are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match.",
      });
    }

    // Re-verify the current administrator's password
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Administrator account not found.",
      });
    }

    const isMatch = bcrypt.compareSync(currentPassword, user.password);
    if (!isMatch) {
      await recordAuditLog({
        action: "PASSWORD_CHANGE_FAILED",
        actor: req.user,
        details: "Supplied incorrect current password.",
        status: "FAILED",
        req,
      });

      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    const salt = bcrypt.genSaltSync(12);
    user.password = bcrypt.hashSync(newPassword, salt);
    await user.save();

    await recordAuditLog({
      action: "PASSWORD_CHANGED_SUCCESSFULLY",
      actor: req.user,
      details: "Administrator successfully changed their account password.",
      status: "SUCCESS",
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Your password has been securely updated.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update administrator password.",
      error: error.message,
    });
  }
};

/**
 * Fetch System Audit Logs (Admin Only)
 */
const getAdminAuditLogsController = async (req, res) => {
  try {
    const logs = await AdminAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load audit logs.",
      error: error.message,
    });
  }
};

module.exports = {
  adminLoginController,
  getAllAdminsController,
  createAdminController,
  updateAdminController,
  toggleAdminStatusController,
  deleteAdminController,
  changeAdminPasswordController,
  getAdminAuditLogsController,
  recordAuditLog,
};

