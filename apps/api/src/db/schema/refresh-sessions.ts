
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index
} from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { sessionStatusEnum } from "./enums.js";

export const refreshSessions = pgTable(
  "refresh_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict"
      }),

    tokenHash: varchar("token_hash", {
      length: 255
    }).notNull().unique(),

    status: sessionStatusEnum("status")
      .notNull().default("active"),

    deviceName: varchar("device_name", {
      length: 150
    }),

    expiresAt: timestamp("expires_at", {
      withTimezone: true
    }).notNull(),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true
    }).defaultNow().notNull()
  },
  (table) => [
    index("refresh_sessions_user_idx").on(table.userId)
  ]
);
