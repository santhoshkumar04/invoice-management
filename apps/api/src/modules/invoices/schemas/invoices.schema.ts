import { z } from "zod";

const gstRateSchema = z.union([
  z.literal(0),
  z.literal(5),
  z.literal(12),
  z.literal(18),
  z.literal(28),
]);

function hasAtMostDecimalPlaces(value: number, maximum: number): boolean {
  const parts = value.toString().toLowerCase().split("e");
  const coefficient = parts[0] ?? "";
  const exponent = parts[1] ? Number(parts[1]) : 0;
  const decimalPlaces =
    (coefficient.split(".")[1]?.length ?? 0) - exponent;

  return decimalPlaces <= maximum;
}
export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(500),

  quantity: z
    .number()
    .finite()
    .positive()
    .max(999999999)
    .refine(
      value => hasAtMostDecimalPlaces(value, 3),
      {
        message: "Quantity supports a maximum of 3 decimal places",
      },
    ),

  rate: z
    .number()
    .finite()
    .min(0)
    .max(999999999999)
    .refine(value => hasAtMostDecimalPlaces(value, 2), {
      message: "Rate supports a maximum of 2 decimal places",
    }),

  // Required for every item when GST is enabled.
  // Never accept calculated tax amounts from the client.
  gstRate: gstRateSchema.optional(),
});

export const createInvoiceSchema = z
  .object({
    customerId: z.string().uuid(),

    invoiceDate: z.iso.date(),

    billingPeriodStart: z.iso.date(),

    billingPeriodEnd: z.iso.date(),

    dueDate: z.iso.date().optional().nullable(),

    currency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase())
      .default("INR"),

    notes: z.string().trim().optional().nullable(),

    // GST is disabled unless explicitly enabled.
    isGstApplicable: z.boolean().default(false),

    items: z
      .array(invoiceItemSchema)
      .min(1, "At least one invoice item is required")
      .max(100, "An invoice cannot contain more than 100 items"),
  })
  .superRefine((data, context) => {
    if (data.billingPeriodEnd < data.billingPeriodStart) {
      context.addIssue({
        code: "custom",
        message:
          "Billing period end must be on or after the billing period start",
        path: ["billingPeriodEnd"],
      });
    }

    data.items.forEach((item, index) => {
      if (data.isGstApplicable && item.gstRate === undefined) {
        context.addIssue({
          code: "custom",
          message: "GST rate is required when GST is enabled",
          path: ["items", index, "gstRate"],
        });
      }

      if (
        !data.isGstApplicable &&
        item.gstRate !== undefined &&
        item.gstRate !== 0
      ) {
        context.addIssue({
          code: "custom",
          message: "GST rates cannot be applied when GST is disabled",
          path: ["items", index, "gstRate"],
        });
      }
    });
  });

// Draft editing uses the same complete, validated payload as invoice creation.
// The backend recalculates all monetary values; client totals are never accepted.
export const updateInvoiceSchema = createInvoiceSchema;

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  search: z.string().trim().max(100).optional(),

  status: z
    .enum(["draft", "issued", "partially_paid", "paid", "cancelled", "all"])
    .default("all"),
});

export const invoiceIdSchema = z.object({
  id: z.string().uuid(),
});

export const createPaymentSchema = z.object({
  paymentDate: z.iso.date(),

  amount: z
    .number()
    .finite()
    .positive()
    .max(999999999999.99)
    .refine(value => hasAtMostDecimalPlaces(value, 2), {
      message: "Payment amount supports a maximum of 2 decimal places",
    }),

  method: z.enum(["cash", "bank_transfer", "upi", "cheque", "card", "other"]),

  referenceNumber: z.string().trim().max(150).optional().nullable(),

  notes: z.string().trim().max(2000).optional().nullable(),
});

export const createInvoiceAdjustmentSchema = z.object({
  type: z.enum(["credit", "debit"]),

  amount: z
    .number()
    .finite()
    .positive()
    .max(999999999999.99)
    .refine(value => hasAtMostDecimalPlaces(value, 2), {
      message: "Adjustment amount supports a maximum of 2 decimal places",
    }),

  reason: z.string().trim().min(5).max(250),

  notes: z.string().trim().max(2000).optional().nullable(),
});

export type CreateInvoiceAdjustmentInput = z.infer<
  typeof createInvoiceAdjustmentSchema
>;

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export type CreateInvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
