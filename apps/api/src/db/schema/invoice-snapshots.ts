
import {
  pgTable,
  uuid,
  jsonb,
  timestamp
} from "drizzle-orm/pg-core";

import { invoices } from "./invoices.js";

export const invoiceSnapshots = pgTable(
  "invoice_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    invoiceId: uuid("invoice_id")
      .notNull()
      .unique()
      .references(() => invoices.id, {
        onDelete: "restrict"
      }),

    snapshotVersion: timestamp("snapshot_version", {
      withTimezone: true
    }).defaultNow().notNull(),

    snapshotData: jsonb("snapshot_data")
      .$type<Record<string, unknown>>()
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true
    }).defaultNow().notNull()
  }
);
