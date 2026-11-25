
import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  index
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations.js";

export const serviceCatalog = pgTable(
  "service_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict"
      }),

    name: varchar("name", {
      length: 250
    }).notNull(),

    defaultRate: numeric("default_rate", {
      precision: 14,
      scale: 2
    }).notNull().default("0"),

    description: varchar("description", {
      length: 500
    }),

    isActive: boolean("is_active")
      .notNull().default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true
    }).defaultNow().notNull()
  },
  (table) => [
    index("service_catalog_org_idx").on(
      table.organizationId,
      table.name
    )
  ]
);
