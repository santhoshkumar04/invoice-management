import { z } from "zod";

const optionalNullableText = (maxLength: number) =>
  z.string().trim().max(maxLength).optional().nullable();

const optionalNullableEmail = z
  .string()
  .trim()
  .email()
  .max(255)
  .optional()
  .nullable();

const optionalNullableUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .optional()
  .nullable();

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),

    businessDescription: optionalNullableText(200),
    logoUrl: optionalNullableUrl,

    vendorCode: optionalNullableText(50),

    addressLine1: optionalNullableText(250),
    addressLine2: optionalNullableText(250),

    city: optionalNullableText(100),
    district: optionalNullableText(100),
    state: optionalNullableText(100),

    stateCode: z
      .string()
      .trim()
      .regex(/^\d{2}$/, "State code must contain exactly 2 digits")
      .optional()
      .nullable(),

    postalCode: optionalNullableText(10),

    country: z.string().trim().min(1).max(100).optional(),

    email: optionalNullableEmail,
    mobile: optionalNullableText(20),

    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
        "Invalid GSTIN format",
      )
      .optional()
      .nullable(),

    pan: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format")
      .optional()
      .nullable(),

    bankName: optionalNullableText(150),
    bankAccountName: optionalNullableText(150),
    bankAccountNumber: optionalNullableText(50),

    bankIfsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC format")
      .optional()
      .nullable(),

    authorizedSignatory: optionalNullableText(150),
    invoiceFooter: z.string().trim().max(5000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
