import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { sendOTPEmail } from "@/lib/email/mailer";

const OTP_COLLECTION = "system_otps";
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
const MAX_ATTEMPTS = 5;

function hashOtp(otp: string, email: string): string {
  return crypto.createHmac("sha256", process.env.FIREBASE_PRIVATE_KEY || "otp_secret").update(`${email}:${otp}`).digest("hex");
}

export interface GenerateOtpResult {
  success: boolean;
  message?: string;
  cooldownRemaining?: number;
}

export async function requestAndSendOTP(email: string): Promise<GenerateOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const otpRef = adminDb.collection(OTP_COLLECTION).doc(normalizedEmail);
  const doc = await otpRef.get();
  const now = Date.now();

  if (doc.exists) {
    const data = doc.data();
    if (data?.lastRequestedAt) {
      const elapsed = now - data.lastRequestedAt;
      if (elapsed < OTP_COOLDOWN_MS) {
        const cooldownRemaining = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
        return {
          success: false,
          message: `Please wait ${cooldownRemaining} seconds before requesting a new OTP.`,
          cooldownRemaining,
        };
      }
    }
  }

  // Generate cryptographically secure 6-digit OTP
  const randomBuffer = crypto.randomBytes(4);
  const otpNum = (randomBuffer.readUInt32BE(0) % 900000) + 100000;
  const otp = otpNum.toString();

  const hashedOtp = hashOtp(otp, normalizedEmail);
  const expiresAt = now + OTP_EXPIRY_MS;

  // Store in Firestore
  await otpRef.set({
    email: normalizedEmail,
    hashedOtp,
    expiresAt,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    lastRequestedAt: now,
    createdAt: new Date().toISOString(),
  });

  // Send via SMTP
  await sendOTPEmail(normalizedEmail, otp);

  return { success: true };
}

export interface VerifyOtpResult {
  valid: boolean;
  message?: string;
  attemptsRemaining?: number;
}

export async function verifyOTP(email: string, enteredOtp: string): Promise<VerifyOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const otpRef = adminDb.collection(OTP_COLLECTION).doc(normalizedEmail);
  const doc = await otpRef.get();

  if (!doc.exists) {
    return { valid: false, message: "No active OTP found. Please request a new OTP." };
  }

  const data = doc.data();
  const now = Date.now();

  if (!data || !data.expiresAt) {
    return { valid: false, message: "Invalid OTP record." };
  }

  // Check expiration
  if (now > data.expiresAt) {
    await otpRef.delete();
    return { valid: false, message: "OTP has expired. Please request a new OTP." };
  }

  // Check attempts
  const attempts = (data.attempts || 0) + 1;
  if (attempts > MAX_ATTEMPTS) {
    await otpRef.delete();
    return { valid: false, message: "Maximum OTP attempts exceeded. Please request a new OTP." };
  }

  const expectedHash = data.hashedOtp;
  const actualHash = hashOtp(enteredOtp.trim(), normalizedEmail);

  if (expectedHash !== actualHash) {
    // Record failed attempt
    await otpRef.update({
      attempts,
    });
    const remaining = MAX_ATTEMPTS - attempts;
    return {
      valid: false,
      message: `Invalid OTP code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      attemptsRemaining: remaining,
    };
  }

  // Success: invalidate OTP immediately
  await otpRef.delete();

  return { valid: true };
}
