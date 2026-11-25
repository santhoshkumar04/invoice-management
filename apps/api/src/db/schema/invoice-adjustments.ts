import {
  pgTable,
  uuid,
  numeric,
  varchar,
  text,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

import { invoices } from "./invoices.js";
import { users } from "./users.js";
import { adjustmentTypeEnum } from "./enums.js";

export const invoiceAdjustments = pgTable(
  "invoice_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, {
        onDelete: "restrict",
      }),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    type: adjustmentTypeEnum("type").notNull(),

    amount: numeric("amount", {
      precision: 14,
      scale: 2,
    }).notNull(),

    reason: varchar("reason", {
      length: 250,
    }).notNull(),

    notes: text("notes"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("invoice_adjustments_invoice_idx").on(table.invoiceId),

    check("invoice_adjustments_amount_positive", sql`${table.amount} > 0`),
  ],
);
