const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/userSchema");
const AdminAuditLog = require("../models/adminAuditLogModel");

const INITIAL_ADMIN_EMAIL = "admin@gmail.com";
const INITIAL_ADMIN_PASSWORD = "admin123456";

/**
 * Idempotently provision the initial master administrator.
 *
 * If the account does not exist, it is created with a strong salted hash (bcrypt).
 * If the account already exists, existing passwords are preserved to avoid
 * unexpected resets after legitimate administrator password changes.
 */
async function seedInitialAdmin() {
  const normalizedEmail = INITIAL_ADMIN_EMAIL.toLowerCase().trim();

  try {
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      let updated = false;

      // Ensure account is active and has full admin role
      if (existing.role !== "admin") {
        existing.role = "admin";
        updated = true;
      }
      if (!existing.isVeriFied) {
        existing.isVeriFied = true;
        updated = true;
      }
      if (existing.isDelete) {
        existing.isDelete = false;
        updated = true;
      }
      if (existing.isHold) {
        existing.isHold = false;
        updated = true;
      }

      if (updated) {
        await existing.save();
        console.log(
          `[Admin Seed] Existing account ${normalizedEmail} confirmed & ensured admin role (password preserved).`
        );
      } else {
        console.log(
          `[Admin Seed] Initial administrator ${normalizedEmail} already exists and is active. Password preserved.`
        );
      }

      return existing;
    }

    // Account does not exist — create initial admin
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(INITIAL_ADMIN_PASSWORD, salt);

    const initialAdmin = new User({
      name: "Master Administrator",
      email: normalizedEmail,
      password: hash,
      role: "admin",
      isVeriFied: true,
      isHold: false,
      isDelete: false,
    });

    await initialAdmin.save();

    // Record audit log
    try {
      await AdminAuditLog.create({
        action: "INITIAL_ADMIN_PROVISIONED",
        actorId: initialAdmin._id,
        actorEmail: normalizedEmail,
        actorName: "System Seed Process",
        actorRole: "system",
        targetId: initialAdmin._id,
        targetEmail: normalizedEmail,
        details: "Initial master administrator account provisioned via seed script.",
        status: "SUCCESS",
      });
    } catch (auditErr) {
      console.warn("[Admin Seed] Audit log write notice:", auditErr.message);
    }

    console.log(
      `[Admin Seed] Successfully provisioned initial administrator: ${normalizedEmail}`
    );
    return initialAdmin;
  } catch (error) {
    console.error("[Admin Seed Error]:", error);
    throw error;
  }
}

// Standalone execution support
if (require.main === module) {
  const dbUrl =
    process.env.MONGODB_URL ||
    "mongodb+srv://ecobazar:ZZBwS59080HIxyRH@cluster0.giyzaxu.mongodb.net/ecobazar?appName=Cluster0";

  mongoose
    .connect(dbUrl)
    .then(async () => {
      console.log("[Admin Seed] Connected to database.");
      await seedInitialAdmin();
      await mongoose.disconnect();
      console.log("[Admin Seed] Database connection closed. Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Admin Seed] Connection error:", err.message);
      process.exit(1);
    });
}

module.exports = { seedInitialAdmin, INITIAL_ADMIN_EMAIL };

