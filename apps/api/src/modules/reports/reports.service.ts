import {
  and,
  count,
  desc,
  inArray,
  ilike,
  or,
  eq,
  gte,
  lte,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  customers,
  invoiceAdjustments,
  invoices,
  payments,
} from "../../db/schema/index.js";

import type { OverviewReportQuery, SalesReportQuery, PaymentsReportQuery, OutstandingReportQuery, GstReportQuery, CustomersReportQuery } from "./schemas/reports.schema.js";

export interface ReportsContext {
  organizationId: string;
  userId: string;
  role: "admin" | "technician";
}

/**
 * Common invoice visibility and date filters.
 * Technicians can only report on invoices they created.
 */
function buildInvoiceFilters(
  context: ReportsContext,
  from?: string,
  to?: string,
): SQL[] {
  const filters: SQL[] = [
    eq(invoices.organizationId, context.organizationId),
    notInArray(invoices.status, ["draft", "cancelled"]),
  ];

  if (context.role === "technician") {
    filters.push(eq(invoices.createdBy, context.userId));
  }

  if (from) {
    filters.push(gte(invoices.invoiceDate, from));
  }

  if (to) {
    filters.push(lte(invoices.invoiceDate, to));
  }

  return filters;
}

/**
 * Payments inherit their access scope through the parent invoice.
 */
function buildPaymentInvoiceFilters(context: ReportsContext): SQL[] {
  const filters: SQL[] = [
    eq(invoices.organizationId, context.organizationId),
  ];

  if (context.role === "technician") {
    filters.push(eq(invoices.createdBy, context.userId));
  }

  return filters;
}

/**
 * Overview report.
 *
 * Invoice count, billed value, and outstanding balance use invoiceDate.
 * Collections use paymentDate. The same optional date range is applied
 * independently to those respective date fields.
 */
export async function getOverviewReport(
  context: ReportsContext,
  input: OverviewReportQuery,
) {
  const invoiceFilters = buildInvoiceFilters(
    context,
    input.from,
    input.to,
  );

  const paymentFilters = buildPaymentInvoiceFilters(context);

  if (input.from) {
    paymentFilters.push(gte(payments.paymentDate, input.from));
  }

  if (input.to) {
    paymentFilters.push(lte(payments.paymentDate, input.to));
  }

  // Aggregate payments independently to prevent join multiplication.
  const paymentTotals = db
    .select({
      invoiceId: payments.invoiceId,
      paymentTotal: sql<string>`coalesce(sum(${payments.amount}), 0)::numeric`.as("payment_total"),
    })
    .from(payments)
    .groupBy(payments.invoiceId)
    .as("report_payment_totals");

  // Debit adjustments increase the balance; credit adjustments reduce it.
  const adjustmentTotals = db
    .select({
      invoiceId: invoiceAdjustments.invoiceId,
      adjustmentTotal: sql<string>`coalesce(
        sum(
          case
            when ${invoiceAdjustments.type} = 'debit'
              then ${invoiceAdjustments.amount}
            else -${invoiceAdjustments.amount}
          end
        ),
        0
      )::numeric`.as("adjustment_total"),
    })
    .from(invoiceAdjustments)
    .groupBy(invoiceAdjustments.invoiceId)
    .as("report_adjustment_totals");

  const [invoiceSummary] = await db
    .select({
      invoiceCount: count().as("invoiceCount"),
      billedTotal: sql<string>`coalesce(
        sum(${invoices.grandTotal}), 0
      )::text`,
      outstandingTotal: sql<string>`coalesce(
        sum(
          ${invoices.grandTotal}
          + coalesce(${adjustmentTotals.adjustmentTotal}, 0)
          - coalesce(${paymentTotals.paymentTotal}, 0)
        ),
        0
      )::text`,
    })
    .from(invoices)
    .leftJoin(
      paymentTotals,
      eq(paymentTotals.invoiceId, invoices.id),
    )
    .leftJoin(
      adjustmentTotals,
      eq(adjustmentTotals.invoiceId, invoices.id),
    )
    .where(and(...invoiceFilters));

  const [collectionSummary] = await db
    .select({
      collectedTotal: sql<string>`coalesce(
        sum(${payments.amount}), 0
      )::text`,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(...paymentFilters));

  return {
    period: {
      from: input.from ?? null,
      to: input.to ?? null,
    },
    dateBasis: {
      invoiceMetrics: "invoiceDate",
      collections: "paymentDate",
    },
    invoiceCount: invoiceSummary?.invoiceCount ?? 0,
    billedTotal: invoiceSummary?.billedTotal ?? "0",
    collectedTotal: collectionSummary?.collectedTotal ?? "0",
    outstandingTotal: invoiceSummary?.outstandingTotal ?? "0",
  };
}

/**
 * Sales report grouped by invoice date.
 *
 * Financial years follow the Indian April-to-March calendar.
 */
export async function getSalesReport(
  context: ReportsContext,
  input: SalesReportQuery,
) {
  let periodExpression: SQL;

  if (input.groupBy === "day") {
    periodExpression = sql`
      to_char(${invoices.invoiceDate}, 'YYYY-MM-DD')
    `;
  } else if (input.groupBy === "financialYear") {
    periodExpression = sql`
      case
        when extract(month from ${invoices.invoiceDate}) >= 4
          then to_char(${invoices.invoiceDate}, 'YYYY')
            || '-'
            || to_char(${invoices.invoiceDate} + interval '1 year', 'YY')
        else to_char(${invoices.invoiceDate} - interval '1 year', 'YYYY')
            || '-'
            || to_char(${invoices.invoiceDate}, 'YY')
      end
    `;
  } else {
    periodExpression = sql`
      to_char(${invoices.invoiceDate}, 'YYYY-MM')
    `;
  }

  const rows = await db
    .select({
      period: sql<string>`${periodExpression}`,
      invoiceCount: count().as("invoiceCount"),
      taxableTotal: sql<string>`coalesce(
        sum(${invoices.subtotal}), 0
      )::text`,
      taxTotal: sql<string>`coalesce(
        sum(${invoices.totalTax}), 0
      )::text`,
      billedTotal: sql<string>`coalesce(
        sum(${invoices.grandTotal}), 0
      )::text`,
    })
    .from(invoices)
    .where(
      and(
        ...buildInvoiceFilters(context, input.from, input.to),
      ),
    )
    .groupBy(periodExpression)
    .orderBy(periodExpression);

  return {
    period: {
      from: input.from ?? null,
      to: input.to ?? null,
    },
    groupBy: input.groupBy,
    dateBasis: "invoiceDate",
    data: rows,
  };
}
/**
 * Payment collections report.
 *
 * Groups actual payment records by payment date and payment method.
 * Payments are scoped through their parent invoice.
 */
export async function getPaymentsReport(
  context: ReportsContext,
  input: PaymentsReportQuery,
) {
  const filters = buildPaymentInvoiceFilters(context);

  // Financial reports exclude drafts and cancelled invoices.
  filters.push(notInArray(invoices.status, ["draft", "cancelled"]));

  if (input.from) {
    filters.push(gte(payments.paymentDate, input.from));
  }

  if (input.to) {
    filters.push(lte(payments.paymentDate, input.to));
  }

  if (input.method) {
    filters.push(eq(payments.method, input.method));
  }

  const rows = await db
    .select({
      paymentDate: payments.paymentDate,
      method: payments.method,
      paymentCount: count(),
      collectedTotal: sql<string>`coalesce(
        sum(${payments.amount}), 0
      )::text`,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(...filters))
    .groupBy(payments.paymentDate, payments.method)
    .orderBy(payments.paymentDate, payments.method);

  const [summary] = await db
    .select({
      paymentCount: count(),
      collectedTotal: sql<string>`coalesce(
        sum(${payments.amount}), 0
      )::text`,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(...filters));

  return {
    period: {
      from: input.from ?? null,
      to: input.to ?? null,
    },
    dateBasis: "paymentDate",
    method: input.method ?? null,
    summary: {
      paymentCount: summary?.paymentCount ?? 0,
      collectedTotal: summary?.collectedTotal ?? "0",
    },
    data: rows,
  };
}
/**
 * Outstanding invoices report.
 *
 * Only issued and partially paid invoices are considered.
 * Payments and adjustments are aggregated independently per invoice.
 */
export async function getOutstandingReport(
  context: ReportsContext,
  input: OutstandingReportQuery,
) {
  const filters = buildInvoiceFilters(
    context,
    input.from,
    input.to,
  );

  filters.push(
    inArray(invoices.status, ["issued", "partially_paid"]),
  );

  if (input.customerId) {
    filters.push(eq(invoices.customerId, input.customerId));
  }

  if (input.status === "unpaid") {
    filters.push(eq(invoices.status, "issued"));
  } else if (input.status === "partially_paid") {
    filters.push(eq(invoices.status, "partially_paid"));
  }

  // Aggregate payment rows independently for each invoice.
  const paymentTotals = db
    .select({
      invoiceId: payments.invoiceId,
      paymentTotal: sql<string>`coalesce(
        sum(${payments.amount}), 0
      )::numeric`.as("payment_total"),
    })
    .from(payments)
    .groupBy(payments.invoiceId)
    .as("outstanding_payment_totals");

  // Debit adjustments increase the balance; credit adjustments reduce it.
  const adjustmentTotals = db
    .select({
      invoiceId: invoiceAdjustments.invoiceId,
      adjustmentTotal: sql<string>`coalesce(
        sum(
          case
            when ${invoiceAdjustments.type} = 'debit'
              then ${invoiceAdjustments.amount}
            else -${invoiceAdjustments.amount}
          end
        ),
        0
      )::numeric`.as("adjustment_total"),
    })
    .from(invoiceAdjustments)
    .groupBy(invoiceAdjustments.invoiceId)
    .as("outstanding_adjustment_totals");

  const balanceExpression = sql`
    ${invoices.grandTotal}
    + coalesce(${adjustmentTotals.adjustmentTotal}, 0)
    - coalesce(${paymentTotals.paymentTotal}, 0)
  `;

  filters.push(sql`${balanceExpression} > 0`);

  const whereCondition = and(...filters);

  const offset = (input.page - 1) * input.limit;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        currency: invoices.currency,
        customerId: customers.id,
        customerName: customers.customerName,
        companyName: customers.companyName,
        grandTotal: invoices.grandTotal,
        adjustedTotal: sql<string>`(
          ${invoices.grandTotal}
          + coalesce(${adjustmentTotals.adjustmentTotal}, 0)
        )::text`,
        paidAmount: sql<string>`coalesce(
          ${paymentTotals.paymentTotal}, 0
        )::text`,
        balanceDue: sql<string>`(${balanceExpression})::text`,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(
        paymentTotals,
        eq(paymentTotals.invoiceId, invoices.id),
      )
      .leftJoin(
        adjustmentTotals,
        eq(adjustmentTotals.invoiceId, invoices.id),
      )
      .where(whereCondition)
      .orderBy(desc(invoices.dueDate), desc(invoices.invoiceDate))
      .limit(input.limit)
      .offset(offset),

    db
      .select({
        total: count(),
      })
      .from(invoices)
      .leftJoin(
        paymentTotals,
        eq(paymentTotals.invoiceId, invoices.id),
      )
      .leftJoin(
        adjustmentTotals,
        eq(adjustmentTotals.invoiceId, invoices.id),
      )
      .where(whereCondition),
  ]);

  const total = countRows[0]?.total ?? 0;

  return {
    period: {
      from: input.from ?? null,
      to: input.to ?? null,
    },
    status: input.status,
    data: rows,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}
/**
 * GST report based on stored invoice tax totals.
 *
 * Includes GST-applicable issued financial invoices only.
 * Draft and cancelled invoices are excluded by buildInvoiceFilters.
 */
export async function getGstReport(
  context: ReportsContext,
  input: GstReportQuery,
) {
  const filters = buildInvoiceFilters(
    context,
    input.from,
    input.to,
  );

  filters.push(eq(invoices.isGstApplicable, true));

  const whereCondition = and(...filters);

  const [summary, supplyBreakdown] = await Promise.all([
    db
      .select({
        invoiceCount: count().as("invoiceCount"),
        taxableTotal: sql<string>`coalesce(
          sum(${invoices.subtotal}), 0
        )::text`,
        cgstTotal: sql<string>`coalesce(
          sum(${invoices.cgstTotal}), 0
        )::text`,
        sgstTotal: sql<string>`coalesce(
          sum(${invoices.sgstTotal}), 0
        )::text`,
        igstTotal: sql<string>`coalesce(
          sum(${invoices.igstTotal}), 0
        )::text`,
        totalTax: sql<string>`coalesce(
          sum(${invoices.totalTax}), 0
        )::text`,
        billedTotal: sql<string>`coalesce(
          sum(${invoices.grandTotal}), 0
        )::text`,
      })
      .from(invoices)
      .where(whereCondition),

    db
      .select({
        supplyType: sql<string>`coalesce(
          ${invoices.supplyType}::text, 'unknown'
        )`,
        invoiceCount: count().as("invoiceCount"),
        taxableTotal: sql<string>`coalesce(
          sum(${invoices.subtotal}), 0
        )::text`,
        cgstTotal: sql<string>`coalesce(
          sum(${invoices.cgstTotal}), 0
        )::text`,
        sgstTotal: sql<string>`coalesce(
          sum(${invoices.sgstTotal}), 0
        )::text`,
        igstTotal: sql<string>`coalesce(
          sum(${invoices.igstTotal}), 0
        )::text`,
        totalTax: sql<string>`coalesce(
          sum(${invoices.totalTax}), 0
        )::text`,
      })
      .from(invoices)
      .where(whereCondition)
      .groupBy(invoices.supplyType)
      .orderBy(invoices.supplyType),
  ]);

  return {
    period: {
      from: input.from ?? null,
      to: input.to ?? null,
    },
    dateBasis: "invoiceDate",
    summary: {
      invoiceCount: summary[0]?.invoiceCount ?? 0,
      taxableTotal: summary[0]?.taxableTotal ?? "0",
      cgstTotal: summary[0]?.cgstTotal ?? "0",
      sgstTotal: summary[0]?.sgstTotal ?? "0",
      igstTotal: summary[0]?.igstTotal ?? "0",
      totalTax: summary[0]?.totalTax ?? "0",
      billedTotal: summary[0]?.billedTotal ?? "0",
    },
    supplyBreakdown,
  };
}
/**
 * Customer-wise financial analytics.
 *
 * Customers without qualifying invoices are included with zero totals.
 * Payments and adjustments are aggregated independently per invoice.
 * Invoice date filters select the invoices included in each customer's
 * financial totals. Payments and adjustments on those invoices are
 * reflected in their current collected and outstanding balances.
 */
export async function getCustomersReport(
  context: ReportsContext,
  input: CustomersReportQuery,
) {
  const invoiceFilters = buildInvoiceFilters(
    context,
    input.from,
    input.to,
  );

  // Aggregate payments independently to avoid multiplying invoice rows.
  const paymentTotals = db
    .select({
      invoiceId: payments.invoiceId,
      paymentTotal: sql<string>`coalesce(
        sum(${payments.amount}), 0
      )::numeric`.as("payment_total"),
    })
    .from(payments)
    .groupBy(payments.invoiceId)
    .as("customer_payment_totals");

  // Debit adjustments increase the balance; credit adjustments reduce it.
  const adjustmentTotals = db
    .select({
      invoiceId: invoiceAdjustments.invoiceId,
      adjustmentTotal: sql<string>`coalesce(
        sum(
          case
            when ${invoiceAdjustments.type} = 'debit'
              then ${invoiceAdjustments.amount}
            else -${invoiceAdjustments.amount}
          end
        ),
        0
      )::numeric`.as("adjustment_total"),
    })
    .from(invoiceAdjustments)
    .groupBy(invoiceAdjustments.invoiceId)
    .as("customer_adjustment_totals");

  // Build one financial aggregate row per customer.
  const invoiceTotals = db
    .select({
      customerId: invoices.customerId,
      invoiceCount: count().as("invoiceCount"),
      taxableTotal: sql<string>`coalesce(
        sum(${invoices.subtotal}), 0
      )::numeric`.as("taxableTotal"),
      billedTotal: sql<string>`coalesce(
        sum(
          ${invoices.grandTotal}
          + coalesce(${adjustmentTotals.adjustmentTotal}, 0)
        ), 0
      )::numeric`.as("billedTotal"),
      collectedTotal: sql<string>`coalesce(
        sum(coalesce(${paymentTotals.paymentTotal}, 0)), 0
      )::numeric`.as("collectedTotal"),
      outstandingTotal: sql<string>`coalesce(
        sum(
          ${invoices.grandTotal}
          + coalesce(${adjustmentTotals.adjustmentTotal}, 0)
          - coalesce(${paymentTotals.paymentTotal}, 0)
        ), 0
      )::numeric`.as("outstandingTotal"),
    })
    .from(invoices)
    .leftJoin(
      paymentTotals,
      eq(paymentTotals.invoiceId, invoices.id),
    )
    .leftJoin(
      adjustmentTotals,
      eq(adjustmentTotals.invoiceId, invoices.id),
    )
    .where(and(...invoiceFilters))
    .groupBy(invoices.customerId)
    .as("customer_invoice_totals");

  const customerFilters: SQL[] = [
    eq(customers.organizationId, context.organizationId),
  ];

  // Technicians can only see customers linked to their visible report invoices.
  if (context.role === "technician") {
    customerFilters.push(
      inArray(
        customers.id,
        db
          .select({ customerId: invoices.customerId })
          .from(invoices)
          .where(and(...invoiceFilters)),
      ),
    );
  }

  if (input.search) {
    const searchPattern = `%${input.search}%`;

    customerFilters.push(
      or(
        ilike(customers.customerName, searchPattern),
        ilike(customers.companyName, searchPattern),
      )!,
    );
  }

  const customerWhere = and(...customerFilters);
  const offset = (input.page - 1) * input.limit;

  const [rows, countRows, summaryRows] = await Promise.all([
    db
      .select({
        customerId: customers.id,
        customerName: customers.customerName,
        companyName: customers.companyName,
        city: customers.city,
        state: customers.state,
        invoiceCount: sql<number>`coalesce(
          ${invoiceTotals.invoiceCount}, 0
        )::int`,
        taxableTotal: sql<string>`coalesce(
          ${invoiceTotals.taxableTotal}, 0
        )::text`,
        billedTotal: sql<string>`coalesce(
          ${invoiceTotals.billedTotal}, 0
        )::text`,
        collectedTotal: sql<string>`coalesce(
          ${invoiceTotals.collectedTotal}, 0
        )::text`,
        outstandingTotal: sql<string>`coalesce(
          ${invoiceTotals.outstandingTotal}, 0
        )::text`,
      })
      .from(customers)
      .leftJoin(
        invoiceTotals,
        eq(invoiceTotals.customerId, customers.id),
      )
      .where(customerWhere)
      .orderBy(customers.customerName)
      .limit(input.limit)
      .offset(offset),

    db
      .select({
        total: count(),
      })
      .from(customers)
      .where(customerWhere),

    db
      .select({
        invoiceCount: sql<number>`coalesce(
          sum(${invoiceTotals.invoiceCount}), 0
        )::int`,
        taxableTotal: sql<string>`coalesce(
          sum(${invoiceTotals.taxableTotal}), 0
        )::text`,
        billedTotal: sql<string>`coalesce(
          sum(${invoiceTotals.billedTotal}), 0
        )::text`,
        collectedTotal: sql<string>`coalesce(
          sum(${invoiceTotals.collectedTotal}), 0
        )::text`,
        outstandingTotal: sql<string>`coalesce(
          sum(${invoiceTotals.outstandingTotal}), 0
        )::text`,
      })
      .from(customers)
      .leftJoin(
        invoiceTotals,
        eq(invoiceTotals.customerId, customers.id),
      )
      .where(customerWhere),
  ]);

  const total = countRows[0]?.total ?? 0;
  const summary = summaryRows[0];

  return {
    period: {
      from: input.from ?? null,
      to: input.to ?? null,
    },
    dateBasis: "invoiceDate",
    search: input.search ?? null,
    summary: {
      customerCount: total,
      invoiceCount: summary?.invoiceCount ?? 0,
      taxableTotal: summary?.taxableTotal ?? "0",
      billedTotal: summary?.billedTotal ?? "0",
      collectedTotal: summary?.collectedTotal ?? "0",
      outstandingTotal: summary?.outstandingTotal ?? "0",
    },
    data: rows,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}