
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations.js";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict"
      }),

    customerName: varchar("customer_name", {
      length: 200
    }).notNull(),

    companyName: varchar("company_name", {
      length: 200
    }),

    contactPerson: varchar("contact_person", {
      length: 150
    }),

    email: varchar("email", { length: 255 }),

    mobile: varchar("mobile", { length: 20 }),

    addressLine1: varchar("address_line_1", {
      length: 250
    }),

    addressLine2: varchar("address_line_2", {
      length: 250
    }),

    city: varchar("city", { length: 100 }),

    district: varchar("district", { length: 100 }),

    state: varchar("state", { length: 100 }),

    stateCode: varchar("state_code", { length: 10 }),

    postalCode: varchar("postal_code", { length: 10 }),

    country: varchar("country", { length: 100 })
      .notNull()
      .default("India"),

    gstin: varchar("gstin", { length: 15 }),

    pan: varchar("pan", { length: 10 }),

    vendorCode: varchar("vendor_code", { length: 50 }),

    notes: text("notes"),

    isActive: boolean("is_active")
      .notNull()
      .default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true
    }).defaultNow().notNull()
  },
  (table) => [
    index("customers_org_name_idx").on(
      table.organizationId,
      table.customerName
    ),
    index("customers_org_mobile_idx").on(
      table.organizationId,
      table.mobile
    )
  ]
);
