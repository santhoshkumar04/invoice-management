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

/**
 * Create a customer.
 *
 * customerName is the primary display name.
 * Other customer details are optional.
 */
export const createCustomerSchema = z.object({
  customerName: z.string().trim().min(2).max(200),

  companyName: optionalNullableText(200),
  contactPerson: optionalNullableText(150),

  email: optionalNullableEmail,
  mobile: optionalNullableText(20),

  addressLine1: optionalNullableText(250),
  addressLine2: optionalNullableText(250),

  city: optionalNullableText(100),
  district: optionalNullableText(100),
  state: optionalNullableText(100),
  stateCode: optionalNullableText(10),
  postalCode: optionalNullableText(10),

  country: z.string().trim().min(1).max(100).optional(),

  gstin: optionalNullableText(15),
  pan: optionalNullableText(10),
  vendorCode: optionalNullableText(50),

  notes: z.string().trim().optional().nullable(),
});

/**
 * Update customer details.
 *
 * At least one field must be provided.
 */
export const updateCustomerSchema = z
  .object({
    customerName: z.string().trim().min(2).max(200).optional(),

    companyName: optionalNullableText(200),
    contactPerson: optionalNullableText(150),

    email: optionalNullableEmail,
    mobile: optionalNullableText(20),

    addressLine1: optionalNullableText(250),
    addressLine2: optionalNullableText(250),

    city: optionalNullableText(100),
    district: optionalNullableText(100),
    state: optionalNullableText(100),
    stateCode: optionalNullableText(10),
    postalCode: optionalNullableText(10),

    country: z.string().trim().min(1).max(100).optional(),

    gstin: optionalNullableText(15),
    pan: optionalNullableText(10),
    vendorCode: optionalNullableText(50),

    notes: z.string().trim().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Activate or deactivate a customer.
 */
export const customerStatusSchema = z.object({
  isActive: z.boolean(),
});

/**
 * Customer list pagination and search.
 *
 * status:
 * - active: active customers only
 * - inactive: inactive customers only
 * - all: both active and inactive customers
 */
export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  search: z.string().trim().max(100).optional(),

  status: z.enum(["active", "inactive", "all"]).default("active"),
});

/**
 * Customer route parameter validation.
 */
export const customerIdSchema = z.object({
  id: z.string().uuid(),
});
