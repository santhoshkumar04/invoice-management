import { z } from "zod";

/**
 * Shared date range.
 *
 * Both dates are optional:
 * - from: inclusive start date
 * - to: inclusive end date
 *
 * When omitted, the report covers all available records.
 */
const dateRangeFields = {
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};

const dateRangeSchema = () =>
  z
    .object(dateRangeFields)
    .refine(
      (data) => !data.from || !data.to || data.from <= data.to,
      {
        message: "Start date must be on or before end date",
        path: ["to"],
      },
    );

/**
 * Business overview report.
 */
export const overviewReportSchema = dateRangeSchema();

/**
 * Sales report.
 *
 * groupBy:
 * - day: daily invoice totals
 * - month: monthly invoice totals
 * - financialYear: Indian financial-year totals
 */
export const salesReportSchema = dateRangeSchema().extend({
  groupBy: z.enum(["day", "month", "financialYear"]).default("month"),
});

/**
 * Payment collections report.
 *
 * Payment dates are used for filtering.
 * method is an optional payment-method filter.
 */
export const paymentsReportSchema = dateRangeSchema().extend({
  method: z.enum(["cash", "bank_transfer", "upi", "cheque", "card", "other"]).optional(),
});

/**
 * Outstanding invoices report.
 *
 * status:
 * - unpaid: issued invoices with no payments
 * - partially_paid: invoices with partial payments
 * - all: both categories
 */
export const outstandingReportSchema = dateRangeSchema().extend({
  status: z.enum(["unpaid", "partially_paid", "all"]).default("all"),

  customerId: z.string().uuid().optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GST report.
 *
 * Uses stored invoice tax totals for issued financial records.
 */
export const gstReportSchema = dateRangeSchema();

/**
 * Customer-wise report.
 *
 * Search matches customer names and company names.
 */
export const customersReportSchema = dateRangeSchema().extend({
  search: z.string().trim().max(100).optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type OverviewReportQuery = z.infer<typeof overviewReportSchema>;
export type SalesReportQuery = z.infer<typeof salesReportSchema>;
export type PaymentsReportQuery = z.infer<typeof paymentsReportSchema>;
export type OutstandingReportQuery = z.infer<
  typeof outstandingReportSchema
>;
export type GstReportQuery = z.infer<typeof gstReportSchema>;
export type CustomersReportQuery = z.infer<typeof customersReportSchema>;
