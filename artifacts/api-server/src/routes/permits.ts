import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { surveysTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { geocodeAddress } from "../services/geocoder";
import { generateSurvey, type PermitRecord } from "../services/surveyGenerator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ARCGIS_BASE =
  "https://gis-mdc.opendata.arcgis.com/datasets/MDC::building-permit.geojson";

interface CitySource {
  name: string;
  fetch: () => Promise<PermitRecord[]>;
}

function inferHorizon(
  permitType: string,
  workDesc: string,
): "IMMINENT" | "NEAR-TERM" | "PROJECTED" {
  const type = permitType.toUpperCase();
  const desc = workDesc.toUpperCase();
  if (type === "DEMOLITION") return "IMMINENT";
  if (desc.includes("TOTAL DEMOLITION") || desc.includes("DEMOLISH"))
    return "NEAR-TERM";
  if (desc.includes("REDEVELOPMENT") || desc.includes("REBUILD"))
    return "NEAR-TERM";
  return "PROJECTED";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

async function safeFetch(url: string, timeoutMs = 12000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

const CITY_SOURCES: CitySource[] = [
  {
    name: "Miami-Dade County (ArcGIS)",
    fetch: async () => {
      const results: PermitRecord[] = [];
      try {
        const where = `RESCOMM='C' AND (TYPE='DEMO' OR FFRMLINE LIKE '%DEMOLIT%' OR FFRMLINE LIKE '%RENOVATION%' OR FFRMLINE LIKE '%REDEVELOP%')`;
        const url = `${ARCGIS_BASE}?where=${encodeURIComponent(where)}&resultRecordCount=100`;
        const resp = await safeFetch(url);
        if (!resp.ok) return results;
        const data = await resp.json();
        if (!data.features) return results;

        for (const feature of data.features) {
          const p = feature.properties;
          const addr = (p.ADDRESS ?? "").trim();
          if (!addr) continue;
          const desc = (p.FFRMLINE ?? "").trim();
          const permitType = (p.TYPE ?? "BLDG").toUpperCase();
          const issueDate = p.ISSUDATE ? formatDate(p.ISSUDATE) : "Unknown";

          results.push({
            address: `${addr}, Miami-Dade County, FL`,
            permitNo: p.PROCNUM ?? `MDC-${p.OBJECTID}`,
            permitType: permitType === "DEMO" ? "DEMOLITION" : "BUILDING",
            issueDate,
            workDescription: desc,
            horizon: inferHorizon(
              permitType === "DEMO" ? "DEMOLITION" : "BUILDING",
              desc,
            ),
          });
        }
      } catch (err) {
        logger.warn({ err }, "ArcGIS fetch failed");
      }
      return results;
    },
  },
];

const SAMPLE_PERMITS: PermitRecord[] = [
  {
    address: "8300 SW 8th St, Miami, FL",
    permitNo: "B-2024-001234",
    permitType: "DEMOLITION",
    issueDate: "January 2024",
    workDescription: "TOTAL DEMOLITION OF EXISTING COMMERCIAL STRUCTURE",
    squareFootage: 12400,
    zoningCode: "BU-1A",
    horizon: "IMMINENT",
  },
  {
    address: "1450 W 49th St, Hialeah, FL",
    permitNo: "B-2024-002891",
    permitType: "BUILDING",
    issueDate: "March 2024",
    workDescription:
      "REDEVELOPMENT OF EXISTING MERCANTILE PLAZA - TOTAL DEMOLITION AND REBUILD",
    squareFootage: 8750,
    zoningCode: "C-1",
    horizon: "NEAR-TERM",
  },
  {
    address: "3190 W Flagler St, Miami, FL",
    permitNo: "B-2023-009341",
    permitType: "BUILDING",
    issueDate: "November 2023",
    workDescription: "MAJOR RENOVATION AND PARTIAL DEMOLITION OF RETAIL STRIP",
    squareFootage: 15200,
    zoningCode: "BU-2",
    horizon: "NEAR-TERM",
  },
  {
    address: "27180 S Dixie Hwy, Naranja, FL",
    permitNo: "B-2023-008841",
    permitType: "DEMOLITION",
    issueDate: "October 2023",
    workDescription: "TOTAL DEMOLITION OF EXISTING COMMERCIAL PLAZA STRUCTURE",
    squareFootage: 18600,
    zoningCode: "BU-1A",
    horizon: "NEAR-TERM",
  },
  {
    address: "12101 SW 152nd St, Miami, FL",
    permitNo: "B-2024-004782",
    permitType: "BUILDING",
    issueDate: "June 2024",
    workDescription: "RENOVATION OF EXISTING RETAIL COMPLEX",
    squareFootage: 9800,
    zoningCode: "BU-1A",
    horizon: "PROJECTED",
  },
];

async function getNextSiteNum(): Promise<number> {
  const rows = await db
    .select({ siteId: surveysTable.siteId })
    .from(surveysTable)
    .orderBy(desc(surveysTable.id))
    .limit(1);
  if (rows.length === 0) return 1;
  const last = parseInt(rows[0].siteId, 10);
  return isNaN(last) ? 1 : last + 1;
}

async function locationExists(address: string): Promise<boolean> {
  const fullLocation = `${address}, Miami-Dade County, Florida`;
  const rows = await db
    .select({ id: surveysTable.id })
    .from(surveysTable)
    .where(eq(surveysTable.location, fullLocation))
    .limit(1);
  return rows.length > 0;
}

async function processPermit(
  permit: PermitRecord,
  siteNum: number,
  sourceCity: string,
  asPendingReview: boolean,
): Promise<boolean> {
  const exists = await locationExists(permit.address);
  if (exists) {
    logger.info({ address: permit.address }, "Skipping duplicate address");
    return false;
  }

  const survey = await generateSurvey(permit, siteNum);
  const geo = await geocodeAddress(permit.address);

  const derivedStatus =
    permit.horizon === "IMMINENT"
      ? "Demolition Pending"
      : permit.horizon === "NEAR-TERM"
        ? "Renovation Pending"
        : permit.horizon === "PROJECTED"
          ? "Declining"
          : "Post-Intervention";

  await db.insert(surveysTable).values({
    siteId: survey.siteId,
    plazaName: survey.plazaName,
    location: `${permit.address}, Miami-Dade County, Florida`,
    surveyDate: survey.surveyDate,
    demolitionHorizon: survey.demolitionHorizon,
    plazaType: survey.plazaType,
    architecturalStyle: survey.architecturalStyle,
    parkingEntropy: survey.parkingEntropy,
    shadeCoverage: survey.shadeCoverage,
    signageDensity: survey.signageDensity,
    vacancyRatio: survey.vacancyRatio,
    pedestrianActivity: survey.pedestrianActivity,
    reportText: survey.reportText,
    permitNo: survey.permitNo,
    permitType: survey.permitType,
    permitIssueDate: survey.permitIssueDate,
    documentRef: survey.documentRef,
    latitude: geo?.lat ?? null,
    longitude: geo?.lng ?? null,
    status: asPendingReview ? "pending_review" : derivedStatus,
    pendingReview: asPendingReview,
    sourceCity,
    lastSyncedAt: new Date(),
    rawAddress: permit.address,
    squareFootage: permit.squareFootage ?? null,
    zoningCode: permit.zoningCode ?? null,
  });

  return true;
}

export async function seedIfEmpty(): Promise<void> {
  const existing = await db
    .select({ id: surveysTable.id })
    .from(surveysTable)
    .limit(1);
  if (existing.length > 0) {
    logger.info("Database already has records, skipping auto-seed");
    return;
  }

  logger.info("Database is empty — running auto-seed with sample permits");
  let processed = 0;
  let errors = 0;
  let siteNum = await getNextSiteNum();

  for (const permit of SAMPLE_PERMITS) {
    try {
      const ok = await processPermit(permit, siteNum, "Sample Data", false);
      if (ok) {
        siteNum++;
        processed++;
      }
    } catch (err) {
      logger.error({ err, address: permit.address }, "Auto-seed failed");
      errors++;
    }
  }

  logger.info({ processed, errors }, "Auto-seed complete");
}

router.post("/permits/sync", async (req, res) => {
  try {
    let processed = 0;
    let errors = 0;
    let siteNum = await getNextSiteNum();
    const sourceResults: Record<string, { found: number; added: number }> = {};

    for (const source of CITY_SOURCES) {
      sourceResults[source.name] = { found: 0, added: 0 };
      let permits: PermitRecord[] = [];

      try {
        permits = await source.fetch();
        sourceResults[source.name].found = permits.length;
        logger.info(
          { city: source.name, count: permits.length },
          "Fetched permits from source",
        );
      } catch (err) {
        logger.warn({ err, city: source.name }, "Source fetch failed entirely");
        continue;
      }

      for (const permit of permits) {
        try {
          const ok = await processPermit(permit, siteNum, source.name, true);
          if (ok) {
            siteNum++;
            processed++;
            sourceResults[source.name].added++;
          }
        } catch (err) {
          logger.error(
            { err, address: permit.address },
            "Error processing permit",
          );
          errors++;
        }
      }
    }

    if (processed === 0) {
      logger.info("No live permits found — checking if sample seed needed");
      const existing = await db
        .select({ id: surveysTable.id })
        .from(surveysTable)
        .limit(1);
      if (existing.length === 0) {
        for (const permit of SAMPLE_PERMITS) {
          try {
            const ok = await processPermit(
              permit,
              siteNum,
              "Sample Data",
              false,
            );
            if (ok) {
              siteNum++;
              processed++;
            }
          } catch (err) {
            logger.error({ err }, "Sample fallback error");
            errors++;
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Sync complete. ${processed} new entries queued for review. ${errors} errors.`,
      processed,
      errors,
      sources: sourceResults,
    });
  } catch (err) {
    req.log.error({ err }, "Sync operation failed");
    res.status(500).json({
      success: false,
      message: "Sync failed",
      processed: 0,
      errors: 1,
    });
  }
});

router.post("/permits/seed", async (req, res) => {
  try {
    let processed = 0;
    let errors = 0;
    let siteNum = await getNextSiteNum();

    for (const permit of SAMPLE_PERMITS) {
      try {
        const ok = await processPermit(permit, siteNum, "Sample Data", false);
        if (ok) {
          siteNum++;
          processed++;
        }
      } catch (err) {
        logger.error({ err, address: permit.address }, "Seed error");
        errors++;
      }
    }

    res.json({
      success: true,
      message: `Seeded ${processed} surveys with ${errors} errors.`,
      processed,
      errors,
    });
  } catch (err) {
    req.log.error({ err }, "Seed operation failed");
    res.status(500).json({
      success: false,
      message: "Seed failed",
      processed: 0,
      errors: 1,
    });
  }
});

export default router;
