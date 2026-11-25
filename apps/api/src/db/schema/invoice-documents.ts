
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index
} from "drizzle-orm/pg-core";

import { invoices } from "./invoices.js";
import { documentCopyEnum } from "./enums.js";

export const invoiceDocuments = pgTable(
  "invoice_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, {
        onDelete: "restrict"
      }),

    copyType: documentCopyEnum("copy_type").notNull(),

    storageKey: text("storage_key").notNull(),

    fileName: varchar("file_name", {
      length: 255
    }).notNull(),

    mimeType: varchar("mime_type", {
      length: 100
    }).notNull().default("application/pdf"),

    fileSize: varchar("file_size", {
      length: 30
    }),

    checksum: varchar("checksum", {
      length: 128
    }),

    generatedAt: timestamp("generated_at", {
      withTimezone: true
    }).defaultNow().notNull()
  },
  (table) => [
    index("invoice_documents_invoice_idx").on(
      table.invoiceId
    )
  ]
);
