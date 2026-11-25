import {
  pgTable,
  uuid,
  varchar,
  date,
  numeric,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

import { organizations } from "./organizations.js";
import { users } from "./users.js";
import { customers } from "./customers.js";
import { invoiceSequences } from "./invoice-sequences.js";
import { invoiceStatusEnum, invoiceSupplyTypeEnum } from "./enums.js";

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict",
      }),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, {
        onDelete: "restrict",
      }),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    sequenceId: uuid("sequence_id").references(() => invoiceSequences.id, {
      onDelete: "restrict",
    }),

    invoiceNumber: varchar("invoice_number", {
      length: 50,
    }),

    invoiceDate: date("invoice_date").notNull(),

    billingPeriodStart: date("billing_period_start").notNull(),

    billingPeriodEnd: date("billing_period_end").notNull(),

    dueDate: date("due_date"),

    vendorCode: varchar("vendor_code", {
      length: 50,
    }),

    status: invoiceStatusEnum("status").notNull().default("draft"),

    currency: varchar("currency", {
      length: 3,
    })
      .notNull()
      .default("INR"),

    // GST is optional and disabled by default.
    isGstApplicable: boolean("is_gst_applicable").notNull().default(false),

    // Set by the backend using organization/customer state codes.
    supplyType: invoiceSupplyTypeEnum("supply_type"),

    // Sum of invoice item amounts before GST.
    subtotal: numeric("subtotal", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    cgstTotal: numeric("cgst_total", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    sgstTotal: numeric("sgst_total", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    igstTotal: numeric("igst_total", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    totalTax: numeric("total_tax", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    roundOff: numeric("round_off", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    grandTotal: numeric("grand_total", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    notes: text("notes"),

    issuedAt: timestamp("issued_at", {
      withTimezone: true,
    }),

    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
    }),

    cancellationReason: text("cancellation_reason"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("invoices_org_number_uidx").on(
      table.organizationId,
      table.invoiceNumber,
    ),

    index("invoices_org_date_idx").on(table.organizationId, table.invoiceDate),

    index("invoices_org_customer_idx").on(
      table.organizationId,
      table.customerId,
    ),

    index("invoices_creator_date_idx").on(table.createdBy, table.createdAt),

    check(
      "invoices_billing_period_check",
      sql`${table.billingPeriodEnd} >= ${table.billingPeriodStart}`,
    ),

    check(
      "invoices_totals_nonnegative",
      sql`
        ${table.subtotal} >= 0
        AND ${table.cgstTotal} >= 0
        AND ${table.sgstTotal} >= 0
        AND ${table.igstTotal} >= 0
        AND ${table.totalTax} >= 0
        AND ${table.grandTotal} >= 0
      `,
    ),

    check(
      "invoices_gst_supply_type_check",
      sql`
        (${table.isGstApplicable} = true AND ${table.supplyType} IS NOT NULL)
        OR
        (${table.isGstApplicable} = false AND ${table.supplyType} IS NULL)
      `,
    ),
  ],
);
