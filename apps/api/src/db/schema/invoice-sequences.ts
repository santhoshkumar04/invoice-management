
import {
  pgTable,
  uuid,
  varchar,
  integer,
  uniqueIndex,
  timestamp
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations.js";

export const invoiceSequences = pgTable(
  "invoice_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict"
      }),

    financialYear: varchar("financial_year", {
      length: 9
    }).notNull(),

    prefix: varchar("prefix", {
      length: 20
    }).notNull().default("INV"),

    lastNumber: integer("last_number")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true
    }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("invoice_sequences_org_year_uidx").on(
      table.organizationId,
      table.financialYear
    )
  ]
);
