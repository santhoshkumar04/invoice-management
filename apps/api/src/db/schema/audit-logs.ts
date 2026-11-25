
import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict"
      }),

    userId: uuid("user_id")
      .references(() => users.id, {
        onDelete: "set null"
      }),

    action: varchar("action", {
      length: 100
    }).notNull(),

    entityType: varchar("entity_type", {
      length: 100
    }).notNull(),

    entityId: uuid("entity_id"),

    description: text("description"),

    oldValues: jsonb("old_values"),

    newValues: jsonb("new_values"),

    ipAddress: varchar("ip_address", {
      length: 50
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true
    }).defaultNow().notNull()
  },
  (table) => [
    index("audit_logs_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),

    index("audit_logs_entity_idx").on(
      table.entityType,
      table.entityId
    )
  ]
);
