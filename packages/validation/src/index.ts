
import { z } from "zod";

export const billingPeriodSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date()
}).refine(
  (period) => period.startDate <= period.endDate,
  {
    message: "Billing period end date must not be before start date",
    path: ["endDate"]
  }
);

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive(),
  rate: z.number().nonnegative()
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  invoiceDate: z.iso.date(),
  billingPeriod: billingPeriodSchema,
  items: z.array(invoiceItemSchema).min(1)
});

export type CreateInvoiceInput = z.infer<
  typeof createInvoiceSchema
>;
