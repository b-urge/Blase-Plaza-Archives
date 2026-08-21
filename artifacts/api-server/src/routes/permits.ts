import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { surveysTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { geocodeAddress } from "../services/geocoder";
import { generateSurvey, type PermitRecord } from "../services/surveyGenerator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Broward County permit data source.
 *
 * Broward County itself does not publish a countywide permit API — permitting is
 * delegated to its 31 municipalities, and the county's own permit portal
 * (dpepp.broward.org/BCS) is a server-rendered ASP.NET form with no machine
 * interface. The City of Fort Lauderdale's ArcGIS "Building Permit Tracker" is
 * the only public, structured, actively-maintained permit feed in the county.
 *
 * CITY_SOURCES is kept as an array so additional Broward municipalities can be
 * appended as they publish open permit endpoints.
 */
const FTL_PERMITS_QUERY =
  "https://gis.fortlauderdale.gov/arcgis/rest/services/BuildingPermitTracker/BuildingPermitTracker/MapServer/0/query";

/** PERMITDESC is a controlled vocabulary; these are the commercial demo/reno values. */
const COMMERCIAL_DEMO_DESC = "Commercial Demolition Permit";
const COMMERCIAL_RENO_DESC = "Commercial Alteration Permit";

/** Permit states that mean the work will never happen — excluded from the sync. */
const DEAD_STATUSES = [
  "Void",
  "Withdrawn",
  "Purged",
  "Expired",
  "Disapproved",
  "CLOSED (2019 HB 447)",
];

/** Permit states that mean work is pending or underway (vs. already finished). */
const IN_PROGRESS_STATUSES = new Set([
  "About to Expire",
  "Approved for Inspections",
  "Approved to Call Inspection",
  "Awaiting Permit Issuance",
  "Corrections Received",
  "Corrections Required",
  "In Process",
  "In Review",
  "Issuance Fees Paid",
  "Issued",
  "Open",
  "Pending",
  "Pending Plan Approval",
  "Plan Set Submitted",
  "Revision Issued",
  "Revision Submitted",
]);

/**
 * USECLASS values that indicate a plaza / strip-retail property — the archive's
 * actual subject. Used to prioritise records, not to exclude them (the field is
 * only populated on a minority of permits).
 */
const PLAZA_USE_CLASSES = new Set([
  "STRIP SHOPPING CTR",
  "RETAIL BUSINESS",
  "SUPERMARKET",
  "OFFICES W/ RETAIL",
  "GAS STA/RETAIL",
  "MULTI USE",
  "DRIV-THRU RESTAURANT",
  "RESTAURANT",
  "RESTAURANT TAKE OUT",
  "RESTAURANT/LOUNGE",
  "BARBER/BEAUTY SHOP",
  "AUTO SERVICE/REPAIR",
]);

interface CitySource {
  name: string;
  fetch: () => Promise<PermitRecord[]>;
}

function inferHorizon(
  permitType: string,
  permitStatus: string,
): "IMMINENT" | "NEAR-TERM" | "PROJECTED" {
  if (permitType === "DEMOLITION") return "IMMINENT";
  if (IN_PROGRESS_STATUSES.has(permitStatus)) return "NEAR-TERM";
  return "PROJECTED";
}

function formatDate(epochMs: number | null | undefined): string {
  if (!epochMs) return "Unknown";
  try {
    return new Date(epochMs).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "Unknown";
  }
}

/**
 * Strip unit/suite suffixes ("1201 NW 62 ST #101" -> "1201 NW 62 ST").
 * The archive documents plazas, not individual tenant bays, so unit-level
 * permits at one address should collapse into a single site record.
 */
function normalizeAddress(addr: string): string {
  return addr
    .split("#")[0]
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,\s]+$/, "");
}

async function safeFetch(url: string, timeoutMs = 20000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

interface ArcGisFeature {
  attributes: Record<string, string | number | null>;
  geometry?: { x: number; y: number };
}

const CITY_SOURCES: CitySource[] = [
  {
    name: "Fort Lauderdale (Broward County ArcGIS)",
    fetch: async () => {
      const results: PermitRecord[] = [];
      try {
        const deadList = DEAD_STATUSES.map((s) => `'${s}'`).join(",");
        const where = [
          `PERMITDESC IN ('${COMMERCIAL_DEMO_DESC}','${COMMERCIAL_RENO_DESC}')`,
          `PERMITSTAT NOT IN (${deadList})`,
          `SUBMITDT >= DATE '2023-01-01'`,
        ].join(" AND ");

        const params = new URLSearchParams({
          where,
          outFields:
            "CASEKEY,PERMITID,PERMITDESC,PERMITSTAT,SUBMITDT,APPROVEDT,FULLADDR,USECLASS,OWNERNAME",
          orderByFields: "SUBMITDT DESC",
          resultRecordCount: "100",
          returnGeometry: "true",
          outSR: "4326",
          f: "json",
        });

        const resp = await safeFetch(`${FTL_PERMITS_QUERY}?${params}`);
        if (!resp.ok) {
          logger.warn(
            { status: resp.status },
            "Broward permit API returned non-OK",
          );
          return results;
        }

        const data = (await resp.json()) as {
          features?: ArcGisFeature[];
          error?: { message?: string };
        };

        if (data.error) {
          logger.warn(
            { error: data.error },
            "Broward permit API returned an error",
          );
          return results;
        }
        if (!data.features) return results;

        const seen = new Set<string>();

        for (const feature of data.features) {
          const a = feature.attributes;
          const rawAddr = String(a.FULLADDR ?? "").trim();
          if (!rawAddr) continue;

          const address = normalizeAddress(rawAddr);
          if (!address) continue;

          // Collapse unit-level duplicates within a single sync batch.
          if (seen.has(address)) continue;
          seen.add(address);

          const desc = String(a.PERMITDESC ?? "");
          const status = String(a.PERMITSTAT ?? "");
          const useClass = a.USECLASS ? String(a.USECLASS).trim() : undefined;
          const permitType =
            desc === COMMERCIAL_DEMO_DESC ? "DEMOLITION" : "BUILDING";

          const workDescription = [
            desc === COMMERCIAL_DEMO_DESC
              ? "COMMERCIAL DEMOLITION"
              : "COMMERCIAL ALTERATION / RENOVATION",
            useClass ? `USE CLASS: ${useClass}` : null,
            status ? `PERMIT STATUS: ${status.toUpperCase()}` : null,
          ]
            .filter(Boolean)
            .join(" — ");

          results.push({
            address: `${address}, Fort Lauderdale`,
            permitNo: String(a.CASEKEY ?? a.PERMITID ?? "UNKNOWN"),
            permitType,
            issueDate: formatDate(
              (a.APPROVEDT as number | null) ?? (a.SUBMITDT as number | null),
            ),
            workDescription,
            useClass,
            horizon: inferHorizon(permitType, status),
            latitude: feature.geometry?.y,
            longitude: feature.geometry?.x,
          });
        }

        // Surface plaza/strip-retail properties first — they are the archive's subject.
        results.sort((x, y) => {
          const px = x.useClass && PLAZA_USE_CLASSES.has(x.useClass) ? 0 : 1;
          const py = y.useClass && PLAZA_USE_CLASSES.has(y.useClass) ? 0 : 1;
          return px - py;
        });
      } catch (err) {
        logger.warn({ err }, "Broward permit API fetch failed");
      }
      return results;
    },
  },
];

/**
 * Real Broward County commercial addresses with active demolition or renovation
 * permits, retrieved from the Fort Lauderdale permit API. Permit numbers, dates
 * and coordinates are genuine source records. Used only to seed an empty
 * database or when the live API is unreachable.
 */
const SAMPLE_PERMITS: PermitRecord[] = [
  {
    address: "3950 N FEDERAL HWY, Fort Lauderdale",
    permitNo: "24CAP-00000-01KRQ",
    permitType: "DEMOLITION",
    issueDate: "November 2024",
    workDescription: "COMMERCIAL DEMOLITION — PERMIT STATUS: COMPLETE",
    horizon: "IMMINENT",
    latitude: 26.17738,
    longitude: -80.11912,
  },
  {
    address: "1924 E SUNRISE BLVD, Fort Lauderdale",
    permitNo: "23CAP-00000-01BJM",
    permitType: "DEMOLITION",
    issueDate: "December 2023",
    workDescription: "COMMERCIAL DEMOLITION — PERMIT STATUS: ISSUED",
    horizon: "IMMINENT",
    latitude: 26.13648,
    longitude: -80.1208,
  },
  {
    address: "2775 E OAKLAND PARK BLVD, Fort Lauderdale",
    permitNo: "24CAP-00000-000YJ",
    permitType: "BUILDING",
    issueDate: "January 2024",
    workDescription:
      "COMMERCIAL ALTERATION / RENOVATION — PERMIT STATUS: COMPLETE",
    horizon: "NEAR-TERM",
    latitude: 26.1678,
    longitude: -80.10935,
  },
  {
    address: "6550 N FEDERAL HWY, Fort Lauderdale",
    permitNo: "23CAP-00000-01DDR",
    permitType: "BUILDING",
    issueDate: "December 2023",
    workDescription:
      "COMMERCIAL ALTERATION / RENOVATION — PERMIT STATUS: CORRECTIONS RECEIVED",
    horizon: "NEAR-TERM",
    latitude: 26.20826,
    longitude: -80.10697,
  },
  {
    address: "3079 E COMMERCIAL BLVD, Fort Lauderdale",
    permitNo: "23CAP-00000-01E2X",
    permitType: "BUILDING",
    issueDate: "December 2023",
    workDescription:
      "COMMERCIAL ALTERATION / RENOVATION — PERMIT STATUS: COMPLETE",
    horizon: "PROJECTED",
    latitude: 26.19038,
    longitude: -80.10475,
  },
  {
    address: "945 W SUNRISE BLVD, Fort Lauderdale",
    permitNo: "23CAP-00000-01D8S",
    permitType: "BUILDING",
    issueDate: "December 2023",
    workDescription:
      "COMMERCIAL ALTERATION / RENOVATION — PERMIT STATUS: COMPLETE",
    horizon: "PROJECTED",
    latitude: 26.13693,
    longitude: -80.15545,
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
  const fullLocation = `${address}, Broward County, Florida`;
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

  // The Broward permit feed ships point geometry, so only fall back to the
  // Nominatim geocoder for records that arrive without coordinates.
  const geo =
    permit.latitude != null && permit.longitude != null
      ? { lat: permit.latitude, lng: permit.longitude }
      : await geocodeAddress(permit.address);

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
    location: `${permit.address}, Broward County, Florida`,
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
