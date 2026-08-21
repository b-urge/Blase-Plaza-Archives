import {
  pgTable,
  serial,
  text,
  real,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const surveysTable = pgTable("surveys", {
  id: serial("id").primaryKey(),
  siteId: text("site_id").notNull().unique(),
  plazaName: text("plaza_name").notNull(),
  location: text("location").notNull(),
  surveyDate: text("survey_date").notNull(),
  demolitionHorizon: text("demolition_horizon").notNull(),
  plazaType: text("plaza_type").notNull(),
  architecturalStyle: text("architectural_style").notNull(),
  parkingEntropy: text("parking_entropy").notNull(),
  shadeCoverage: text("shade_coverage").notNull(),
  signageDensity: text("signage_density").notNull(),
  vacancyRatio: text("vacancy_ratio").notNull(),
  pedestrianActivity: text("pedestrian_activity").notNull(),
  reportText: text("report_text").notNull(),
  permitNo: text("permit_no").notNull(),
  permitType: text("permit_type").notNull(),
  permitIssueDate: text("permit_issue_date").notNull(),
  /** Real date behind permitIssueDate's display string, for sorting and filtering. */
  permitDate: timestamp("permit_date"),
  documentRef: text("document_ref").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  status: text("status").notNull().default("ACTIVE"),
  pendingReview: boolean("pending_review").notNull().default(false),
  reviewedAt: timestamp("reviewed_at"),
  sourceCity: text("source_city"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at"),
  rawAddress: text("raw_address"),
  squareFootage: integer("square_footage"),
  zoningCode: text("zoning_code"),
});

export const insertSurveySchema = createInsertSchema(surveysTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type Survey = typeof surveysTable.$inferSelect;
