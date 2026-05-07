const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 587,
  secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
  auth: {
    user: "saudshakil5@gmail.com",
    pass: "adysflhkghdvsamk",
  },
});

let mailVeryfication = async (token, email) => {
  try {
    const info = await transporter.sendMail({
      from: `saudshakil5@gmail.com`, // sender address
      to: email, // list of recipients
      subject: "Please verify your Email", // subject line

      html: `<body style=margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4><table align=center style=background:#fff;margin-top:20px;border-radius:8px;overflow:hidden width=600><tr><td style=background:#28a745;padding:20px;text-align:center;color:#fff;font-size:24px;font-weight:700>Ecobazar<tr><td style=padding:30px;color:#333;text-align:center><h2 style=margin-top:0>Verify Your Email ✅</h2><p>Hello,<p>Thank you for signing up with <strong>Ecobazar</strong>. Please confirm your email address to activate your account.<p style="margin:30px 0"><a href="http://localhost5173/verifyemal/${token}" style="background:#28a745;color:#fff;padding:14px 30px;text-decoration:none;border-radius:5px;font-weight:700;display:inline-block">Verify Email</a><p>If the button doesn't work, copy and paste the link below into your browser:<p style=word-break:break-all;color:#555>"http://localhost5173/verifyemal/${token}" <p style=margin-top:30px>This link will expire in 10 minutes.<p>If you did not create an account, you can safely ignore this email.<tr><td style=background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777>© 2026 Ecobazar | All Rights Reserved<br>Dhaka, Bangladesh</table>`, // HTML body
    });

    console.log("Message sent: %s", info.messageId);
    // Preview URL is only available when using an Ethereal test account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error("Error while sending mail:", err);
  }
};

let resetPasswordMail = async (token, email) => {
  try {
    const info = await transporter.sendMail({
      from: `saudshakil5@gmail.com`, // sender address
      to: email, // list of recipients
      subject: "Please reset your Password", // subject line

      html: `<body style=margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif><table border=0 cellpadding=0 cellspacing=0 width=100%><tr><td style="padding:40px 0"align=center><table border=0 cellpadding=0 cellspacing=0 style=background:#fff;border-radius:10px;overflow:hidden width=600><tr><td style=background:#22c55e;padding:30px;color:#fff align=center><h1 style=margin:0;font-size:32px>Ecobazar</h1><p style=margin-top:10px;font-size:16px>Fresh Grocery & Organic Food<tr><td style=padding:40px;color:#333><h2 style=margin-top:0>Reset Your Password</h2><p style=font-size:16px;line-height:26px>Hello,<p style=font-size:16px;line-height:26px>We received a request to reset your password for your Ecobazar account.<p style=font-size:16px;line-height:26px>Click the button below to create a new password:<table border=0 cellpadding=0 cellspacing=0 style="margin:30px auto"align=center><tr><td style=border-radius:6px align=center bgcolor=#22c55e><a href="http://localhost5173/resetpassword/${token}"style="display:inline-block;padding:14px 30px;color:#fff;text-decoration:none;font-size:16px;font-weight:700">Reset Password</a></table><p style=font-size:15px;line-height:24px;color:#666>If you did not request a password reset, you can safely ignore this email.<p style=font-size:15px;line-height:24px;color:#666>This password reset link will expire in 15 minutes.<hr style="border:none;border-top:1px solid #eee;margin:30px 0"><p style=font-size:14px;color:#999;text-align:center>© 2026 Ecobazar. All rights reserved.</table></table>:<p style=word-break:break-all;color:#555>"http://localhost5173/resetpassword/${token}" <p style=margin-top:30px>This link will expire in 10 minutes.<p>If you did not create an account, you can safely ignore this email.<tr><td style=background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777>© 2026 Ecobazar | All Rights Reserved<br>Dhaka, Bangladesh</table>`, // HTML body
    });

    console.log("Message sent: %s", info.messageId);
    // Preview URL is only available when using an Ethereal test account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error("Error while sending mail:", err);
  }
};

module.exports = { mailVeryfication, resetPasswordMail };
