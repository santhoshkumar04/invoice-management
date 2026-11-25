import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  check,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Database-enforced single organization.
    singletonKey: integer("singleton_key").notNull().default(1).unique(),

    name: varchar("name", { length: 200 }).notNull(),

    businessDescription: varchar("business_description", {
      length: 200,
    }),

    logoUrl: text("logo_url"),

    // Company registration / vendor identification
    vendorCode: varchar("vendor_code", { length: 50 }),

    addressLine1: varchar("address_line_1", { length: 250 }),
    addressLine2: varchar("address_line_2", { length: 250 }),

    city: varchar("city", { length: 100 }),
    district: varchar("district", { length: 100 }),
    state: varchar("state", { length: 100 }),

    stateCode: varchar("state_code", { length: 10 }),
    postalCode: varchar("postal_code", { length: 10 }),

    country: varchar("country", { length: 100 }).notNull().default("India"),

    email: varchar("email", { length: 255 }),
    mobile: varchar("mobile", { length: 20 }),

    gstin: varchar("gstin", { length: 15 }),
    pan: varchar("pan", { length: 10 }),

    bankName: varchar("bank_name", { length: 150 }),
    bankAccountName: varchar("bank_account_name", { length: 150 }),
    bankAccountNumber: varchar("bank_account_number", { length: 50 }),
    bankIfsc: varchar("bank_ifsc", { length: 11 }),

    authorizedSignatory: varchar("authorized_signatory", {
      length: 150,
    }),

    invoiceFooter: text("invoice_footer"),

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
    check("organizations_singleton_key_check", sql`${table.singletonKey} = 1`),
  ],
);
