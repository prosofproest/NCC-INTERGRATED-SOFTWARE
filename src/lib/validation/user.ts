import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "cto", "cadet"]);

export const UserProfileSchema = z.object({
  uid: z.string().min(1, "UID is required"),
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  role: UserRoleSchema,
  mustChangePassword: z.boolean().default(false),
  cadetId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const LoginInputSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const ChangePasswordInputSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password is too long"),
});

export const OtpInputSchema = z.object({
  email: z.string().email("Valid email is required"),
  otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d+$/, "OTP must contain numbers only"),
});
