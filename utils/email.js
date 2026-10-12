const nodemailer = require("nodemailer");

const getTransporter = () => {
  const user = process.env.EMAIL_USER || "saudshakil5@gmail.com";
  const pass = process.env.EMAIL_PASS || "adysflhkghdvsamk";

  return nodemailer.createTransport({
    service: "gmail",
    port: 587,
    secure: false,
    auth: {
      user: user,
      pass: pass,
    },
  });
};

const mailVeryfication = async (token, email) => {
  try {
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173")
      .trim()
      .replace(/\/+$/, "");
    const verificationUrl = `${frontendUrl}/verifyemail/${token}`;
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: `"Ecobazar" <${process.env.EMAIL_USER || "saudshakil5@gmail.com"}>`,
      to: email,
      subject: "Please verify your Email - Ecobazar",
      html: `
        <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4">
          <table align="center" style="background:#fff;margin-top:20px;border-radius:8px;overflow:hidden" width="600">
            <tr>
              <td style="background:#28a745;padding:20px;text-align:center;color:#fff;font-size:24px;font-weight:700">
                Ecobazar
              </td>
            </tr>
            <tr>
              <td style="padding:30px;color:#333;text-align:center">
                <h2 style="margin-top:0">Verify Your Email ✅</h2>
                <p>Hello,</p>
                <p>Thank you for signing up with <strong>Ecobazar</strong>. Please confirm your email address to activate your account.</p>
                <p style="margin:30px 0">
                  <a href="${verificationUrl}" style="background:#28a745;color:#fff;padding:14px 30px;text-decoration:none;border-radius:5px;font-weight:700;display:inline-block">Verify Email</a>
                </p>
                <p>If the button doesn't work, copy and paste the link below into your browser:</p>
                <p style="word-break:break-all;color:#555">${verificationUrl}</p>
                <p style="margin-top:30px;color:#888;font-size:13px">This link will expire in 24 hours.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777">
                © 2026 Ecobazar | All Rights Reserved<br>Dhaka, Bangladesh
              </td>
            </tr>
          </table>
        </body>`,
    });

    console.log("Verification email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("Error while sending verification email:", err.message);
    return false;
  }
};

const resetPasswordMail = async (token, email) => {
  try {
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173")
      .trim()
      .replace(/\/+$/, "");
    const resetUrl = `${frontendUrl}/resetpassword/${token}`;
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: `"Ecobazar Support" <${process.env.EMAIL_USER || "saudshakil5@gmail.com"}>`,
      to: email,
      subject: "Reset Your Password - Ecobazar",
      html: `
        <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:40px 0" align="center">
                <table border="0" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden" width="600">
                  <tr>
                    <td style="background:#22c55e;padding:30px;color:#fff" align="center">
                      <h1 style="margin:0;font-size:32px">Ecobazar</h1>
                      <p style="margin-top:10px;font-size:16px">Fresh Grocery & Organic Food</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;color:#333">
                      <h2 style="margin-top:0">Reset Your Password</h2>
                      <p style="font-size:15px;line-height:24px">Hello,</p>
                      <p style="font-size:15px;line-height:24px">We received a request to reset your password for your Ecobazar account.</p>
                      <table border="0" cellpadding="0" cellspacing="0" style="margin:30px auto" align="center">
                        <tr>
                          <td style="border-radius:6px" align="center" bgcolor="#22c55e">
                            <a href="${resetUrl}" style="display:inline-block;padding:14px 30px;color:#fff;text-decoration:none;font-size:16px;font-weight:700">Reset Password</a>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:14px;color:#666">If you did not request a password reset, you can safely ignore this email.</p>
                      <p style="font-size:13px;color:#999;word-break:break-all">${resetUrl}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777">
                      © 2026 Ecobazar. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>`,
    });

    console.log("Password reset email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("Error while sending reset email:", err.message);
    return false;
  }
};

module.exports = { mailVeryfication, resetPasswordMail };
