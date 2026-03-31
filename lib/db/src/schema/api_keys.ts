import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const apiKeysTable = pgTable("api_keys", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  email: text("email").notNull(),
  intendedUse: text("intended_use"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  isActive: boolean("is_active").notNull().default(true),
  requestCount: integer("request_count").notNull().default(0),
  dailyCount: integer("daily_count").notNull().default(0),
  dayStart: timestamp("day_start"),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;
