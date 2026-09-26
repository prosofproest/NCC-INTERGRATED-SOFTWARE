import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("Missing SMTP credentials (SMTP_USER or SMTP_PASS).");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendMailOptions) {
  const transporter = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || "NCC Data System";
  const fromEmail = process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || "noreply@organization.org";
  const from = `"${fromName}" <${fromEmail}>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>?/gm, ""),
  });

  return info;
}

export async function sendOTPEmail(to: string, otp: string) {
  const subject = "Your One-Time Passcode (OTP) — NCC Data System";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; margin-bottom: 24px; }
          .badge { display: inline-block; padding: 4px 12px; background-color: #0a192f; color: #ffffff; font-weight: 700; border-radius: 6px; font-size: 13px; letter-spacing: 0.05em; }
          .title { font-size: 20px; font-weight: 700; margin: 16px 0 8px; color: #0a192f; }
          .otp-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; padding: 18px; margin: 24px 0; }
          .otp-code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0a192f; margin: 0; }
          .meta { font-size: 14px; color: #475569; line-height: 1.6; }
          .warning { font-size: 12px; color: #64748b; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">NCC INTEGRATED SYSTEM</span>
            <h1 class="title">Authentication Verification</h1>
          </div>
          <p class="meta">Jai Hind,</p>
          <p class="meta">Please use the following One-Time Passcode (OTP) to complete your verification into the NCC Data Collection &amp; Organization System:</p>
          <div class="otp-card">
            <div class="otp-code">${otp}</div>
          </div>
          <p class="meta">This code will expire in <strong>10 minutes</strong>. For security, never share this code with anyone.</p>
          <div class="warning">
            If you did not request this verification, please contact your unit administrator immediately.
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `Jai Hind.\n\nYour One-Time Passcode (OTP) for the NCC Data System is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const subject = "Password Reset Request — NCC Data System";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; margin-bottom: 24px; }
          .badge { display: inline-block; padding: 4px 12px; background-color: #0a192f; color: #ffffff; font-weight: 700; border-radius: 6px; font-size: 13px; letter-spacing: 0.05em; }
          .title { font-size: 20px; font-weight: 700; margin: 16px 0 8px; color: #0a192f; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background-color: #0a192f; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; }
          .meta { font-size: 14px; color: #475569; line-height: 1.6; }
          .link-fallback { font-size: 12px; word-break: break-all; color: #64748b; margin-top: 16px; }
          .warning { font-size: 12px; color: #64748b; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">NCC INTEGRATED SYSTEM</span>
            <h1 class="title">Reset Your Password</h1>
          </div>
          <p class="meta">Jai Hind,</p>
          <p class="meta">We received a request to reset your password for your account in the NCC Data Collection &amp; Organization System.</p>
          <div class="btn-container">
            <a href="${resetLink}" class="btn" style="color: #ffffff;">Reset Password</a>
          </div>
          <p class="meta">Or copy and paste this link into your browser:</p>
          <p class="link-fallback">${resetLink}</p>
          <p class="meta">This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
          <div class="warning">
            National Cadet Corps • Data Collection &amp; Organization System
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `Jai Hind.\n\nTo reset your password for the NCC Data System, open the following link in your browser:\n\n${resetLink}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
  });
}
