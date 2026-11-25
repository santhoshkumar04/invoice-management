
import {
  pgTable,
  uuid,
  numeric,
  date,
  varchar,
  text,
  timestamp,
  index,
  check
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import { invoices } from "./invoices.js";
import { users } from "./users.js";
import { paymentMethodEnum } from "./enums.js";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, {
        onDelete: "restrict"
      }),

    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict"
      }),

    paymentDate: date("payment_date").notNull(),

    amount: numeric("amount", {
      precision: 14,
      scale: 2
    }).notNull(),

    method: paymentMethodEnum("method")
      .notNull(),

    referenceNumber: varchar("reference_number", {
      length: 150
    }),

    notes: text("notes"),

    createdAt: timestamp("created_at", {
      withTimezone: true
    }).defaultNow().notNull()
  },
  (table) => [
    index("payments_invoice_idx").on(table.invoiceId),

    check(
      "payments_amount_positive",
      sql`${table.amount} > 0`
    )
  ]
);
