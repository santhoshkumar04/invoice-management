import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import { invoices } from "./invoices.js";

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, {
        onDelete: "restrict",
      }),

    lineNumber: integer("line_number").notNull(),

    description: varchar("description", {
      length: 500,
    }).notNull(),

    quantity: numeric("quantity", {
      precision: 12,
      scale: 3,
    }).notNull(),

    rate: numeric("rate", {
      precision: 14,
      scale: 2,
    }).notNull(),

    // Taxable line amount: quantity multiplied by rate.
    amount: numeric("amount", {
      precision: 14,
      scale: 2,
    }).notNull(),

    // Zero when GST is not applicable.
    gstRate: numeric("gst_rate", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("0"),

    cgstAmount: numeric("cgst_amount", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    sgstAmount: numeric("sgst_amount", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    igstAmount: numeric("igst_amount", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("invoice_items_invoice_idx").on(table.invoiceId),

    check("invoice_items_quantity_positive", sql`${table.quantity} > 0`),

    check("invoice_items_rate_nonnegative", sql`${table.rate} >= 0`),

    check("invoice_items_amount_nonnegative", sql`${table.amount} >= 0`),

    check("invoice_items_line_number_positive", sql`${table.lineNumber} > 0`),

    check(
      "invoice_items_gst_rate_allowed",
      sql`${table.gstRate} IN (0, 5, 12, 18, 28)`,
    ),

    check(
      "invoice_items_tax_amounts_nonnegative",
      sql`
        ${table.cgstAmount} >= 0
        AND ${table.sgstAmount} >= 0
        AND ${table.igstAmount} >= 0
      `,
    ),
  ],
);
