import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations.js";
import { userRoleEnum } from "./enums.js";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "restrict",
      }),

    fullName: varchar("full_name", { length: 150 }).notNull(),

    email: varchar("email", { length: 255 }).notNull(),

    mobile: varchar("mobile", { length: 20 }),

    passwordHash: varchar("password_hash", {
      length: 255,
    }).notNull(),

    role: userRoleEnum("role").notNull(),

    isActive: boolean("is_active").notNull().default(true),

    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
    }),

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
    uniqueIndex("users_org_email_uidx").on(table.organizationId, table.email),
  ],
);
