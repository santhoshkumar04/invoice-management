import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),

  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(40).max(200),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(40).max(200),
});

export const updateCurrentUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150).optional(),
    mobile: z.string().trim().max(20).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type UpdateCurrentUserInput = z.infer<typeof updateCurrentUserSchema>;

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
