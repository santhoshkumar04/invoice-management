import { z } from "zod";

export const createTechnicianSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  mobile: z.string().trim().max(20).optional().nullable(),
  password: z.string().min(12).max(128),
});

export const updateTechnicianSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150).optional(),
    email: z.string().trim().email().max(255).optional(),
    mobile: z.string().trim().max(20).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const technicianStatusSchema = z.object({
  isActive: z.boolean(),
});

export const resetTechnicianPasswordSchema = z.object({
  newPassword: z.string().min(12).max(128),
});

export const listTechniciansSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const technicianIdSchema = z.object({
  id: z.string().uuid(),
});
