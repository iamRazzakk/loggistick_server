import { z } from "zod";

const createVerifyEmailZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email({ message: "Invalid email address" }),
    oneTimeCode: z.number({ required_error: "One time code is required" }),
  }),
});

const createLoginZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email({ message: "Invalid email address" }),
    password: z.string({ required_error: "Password is required" }),
    fcmToken: z.string().min(1).optional(),
  }),
});

const createSocialLoginZodSchema = z.object({
  body: z.object({
    // Firebase ID token from the app (FirebaseAuth.currentUser.getIdToken())
    token: z.string({ required_error: "Token is required" }).min(1),
    social_type: z
      .string()
      .transform((v) => v.toLowerCase())
      .pipe(z.enum(["google", "apple", "facebook"]))
      .optional(),
    role: z
      .string()
      .transform((v) => v.toUpperCase())
      .pipe(z.enum(["USER", "DRIVER"]))
      .optional(),
    fcmToken: z.string().min(1).optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    picture: z.string().optional(),
    appId: z.string().optional(),
  }),
});

const createForgetPasswordZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email({ message: "Invalid email address" }),
  }),
});

const createResendOtpZodSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email({ message: "Invalid email address" }),
  }),
});

const createResetPasswordZodSchema = z.object({
  body: z.object({
    newPassword: z.string({ required_error: "Password is required" }),
    confirmPassword: z.string({
      required_error: "Confirm Password is required",
    }),
  }),
});

const createChangePasswordZodSchema = z.object({
  body: z.object({
    currentPassword: z.string({
      required_error: "Current Password is required",
    }),
    newPassword: z.string({ required_error: "New Password is required" }),
    confirmPassword: z.string({
      required_error: "Confirm Password is required",
    }),
  }),
});

export const AuthValidation = {
  createVerifyEmailZodSchema,
  createForgetPasswordZodSchema,
  createLoginZodSchema,
  createResetPasswordZodSchema,
  createChangePasswordZodSchema,
  createResendOtpZodSchema,
  createSocialLoginZodSchema,
};
