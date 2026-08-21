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

/**
 * Permit lifecycle buckets.
 *
 * The archive's four horizons are defined by permit *lifecycle stage* (see the
 * glossary on the List page), not by permit type. A completed demolition is not
 * "imminent" — it has already happened, which is what EXPIRED records.
 */

/** The work will never happen. These records are not archived at all. */
const DEAD_STATUSES = ["Void", "Withdrawn", "Purged", "Disapproved"];

/** The work is finished or the permit has lapsed -> EXPIRED. */
const ENDED_STATUSES = new Set(["Complete", "Expired", "CLOSED (2019 HB 447)"]);

/** The permit is issued and work is underway -> IMMINENT / NEAR-TERM. */
const UNDERWAY_STATUSES = new Set([
  "About to Expire",
  "Approved for Inspections",
  "Approved to Call Inspection",
  "Awaiting CC Acceptance Review",
  "Awaiting CO Acceptance Review",
  "Awaiting Inspection Approval",
  "Awaiting PCO Approval",
  "CC Packet Accepted",
  "CC Packet Sent for Review",
  "CC Packet Submittal Pending",
  "CO Packet Accepted",
  "CO Packet Sent for Review",
  "CO Packet Submittal Pending",
  "Coordination Approved",
  "Extension Approved",
  "Issuance Fees Paid",
  "Issued",
  "Open",
  "PCO Approved",
  "Revision Fees Paid",
  "Revision Issued",
  "TCO Approved",
  "TCO Request Received",
]);
// Anything else that is still alive is pre-issuance -> PROJECTED.

/**
 * Broward County Property Appraiser parcel attributes, joined on the permit's
 * PARCELID (a 12-digit BCPA folio). Supplies the building square footage,
 * year of construction and DOR use code that the permit feed does not publish.
 */
const BCPA_PARCEL_QUERY =
  "https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/PARCEL_POLY_BCPA_TAXROLL/FeatureServer/0/query";

/** City of Fort Lauderdale zoning districts, resolved by point-in-polygon. */
const FTL_ZONING_QUERY =
  "https://gis.fortlauderdale.gov/arcgis/rest/services/Accela/Accela/MapServer/4/query";

/**
 * Florida DOR property use codes, mapped to the archive's plaza vocabulary.
 * Only codes that describe a commercial plaza, strip or pad site are listed;
 * anything mapped here is in scope for the archive.
 */
const DOR_PLAZA_TYPES: Record<string, { label: string; plazaType: string }> = {
  "11": { label: "Stores, one story", plazaType: "Single-Story Retail Strip" },
  "12": {
    label: "Mixed use — store and office or residential",
    plazaType: "Mixed Commercial Block",
  },
  "13": { label: "Department store", plazaType: "Department Store Site" },
  "14": { label: "Supermarket", plazaType: "Anchor Grocery Site" },
  "15": {
    label: "Regional shopping center",
    plazaType: "Regional Shopping Center",
  },
  "16": {
    label: "Community shopping center",
    plazaType: "Community Shopping Center",
  },
  "17": {
    label: "Office building, one story",
    plazaType: "Low-Rise Commercial Node",
  },
  "19": {
    label: "Professional service building",
    plazaType: "Professional Service Strip",
  },
  "21": { label: "Restaurant or cafeteria", plazaType: "Restaurant Pad Site" },
  "22": { label: "Drive-in restaurant", plazaType: "Drive-Through Pad Site" },
  "23": { label: "Financial institution", plazaType: "Financial Branch Site" },
  "26": { label: "Service station", plazaType: "Fuel and Convenience Node" },
  "27": {
    label: "Auto sales, repair or service",
    plazaType: "Automotive Service Node",
  },
};

/**
 * DOR use codes that are definitively not commercial plazas. Records matching
 * these are dropped — previously the sync archived apartment buildings, a
 * hospital and a county government office as plazas.
 *
 * Records whose use code is unknown are KEPT: BCPA does not publish a use code
 * for every parcel, and excluding unknowns would discard real plazas.
 */
function isExcludedUseCode(code: string | undefined): boolean {
  if (!code) return false; // unknown -> keep
  const n = parseInt(code, 10);
  if (isNaN(n)) return false;
  if (n <= 9) return true; // 00-09 residential
  if (n === 18) return true; // multi-story office towers
  if (n >= 39 && n <= 49) return true; // hotels, industrial, warehousing
  if (n >= 70 && n <= 79) return true; // institutional (hospitals, homes)
  if (n >= 80) return true; // government, public, misc
  return false;
}

interface CitySource {
  name: string;
  fetch: () => Promise<PermitRecord[]>;
}

function inferHorizon(
  permitType: string,
  permitStatus: string,
): "IMMINENT" | "NEAR-TERM" | "PROJECTED" | "EXPIRED" {
  // Finished or lapsed: the intervention has already occurred.
  if (ENDED_STATUSES.has(permitStatus)) return "EXPIRED";
  // Issued and underway: demolition is the more urgent of the two.
  if (UNDERWAY_STATUSES.has(permitStatus)) {
    return permitType === "DEMOLITION" ? "IMMINENT" : "NEAR-TERM";
  }
  // Still in plan review / pre-issuance.
  return "PROJECTED";
}

/** Public status shown for each horizon. Keep in sync with admin.ts. */
export function statusForHorizon(horizon: string): string {
  switch (horizon) {
    case "IMMINENT":
      return "Demolition Pending";
    case "NEAR-TERM":
      return "Renovation Pending";
    case "PROJECTED":
      return "Declining";
    case "EXPIRED":
      return "Post-Intervention";
    default:
      return "Declining";
  }
}

interface ParcelRecord {
  squareFootage?: number;
  yearBuilt?: number;
  useCode?: string;
}

/**
 * Batch-fetch BCPA parcel attributes for a set of folios in a single query.
 * Returns an empty map on failure — enrichment is best-effort and must never
 * block a sync.
 */
async function fetchParcels(
  folios: string[],
): Promise<Map<string, ParcelRecord>> {
  const out = new Map<string, ParcelRecord>();
  const unique = [...new Set(folios.filter(Boolean))];
  if (unique.length === 0) return out;

  try {
    const inList = unique.map((f) => `'${f.replace(/'/g, "")}'`).join(",");
    const params = new URLSearchParams({
      where: `FOLIO IN (${inList})`,
      outFields:
        "FOLIO,BLDG_TOT_SQ_FOOTAGE,ACTUAL_YEAR_BUILT,BLDG_YEAR_BUILT,USE_CODE",
      returnGeometry: "false",
      f: "json",
    });
    const resp = await safeFetch(`${BCPA_PARCEL_QUERY}?${params}`, 30000);
    if (!resp.ok) {
      logger.warn(
        { status: resp.status },
        "BCPA parcel lookup returned non-OK",
      );
      return out;
    }
    const data = (await resp.json()) as {
      features?: { attributes: Record<string, string | number | null> }[];
      error?: unknown;
    };
    if (data.error || !data.features) {
      logger.warn({ error: data.error }, "BCPA parcel lookup failed");
      return out;
    }

    for (const f of data.features) {
      const a = f.attributes;
      const folio = String(a.FOLIO ?? "").trim();
      if (!folio) continue;
      const sqft = Number(a.BLDG_TOT_SQ_FOOTAGE);
      const year = Number(a.ACTUAL_YEAR_BUILT ?? a.BLDG_YEAR_BUILT);
      out.set(folio, {
        squareFootage: Number.isFinite(sqft) && sqft > 0 ? sqft : undefined,
        yearBuilt: Number.isFinite(year) && year > 1800 ? year : undefined,
        useCode: a.USE_CODE ? String(a.USE_CODE).trim() : undefined,
      });
    }
    logger.info(
      { requested: unique.length, matched: out.size },
      "BCPA parcel lookup",
    );
  } catch (err) {
    logger.warn({ err }, "BCPA parcel lookup threw");
  }
  return out;
}

/** Resolve the zoning district containing a point. Best-effort. */
async function fetchZoning(
  lat: number,
  lng: number,
): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({
      geometry: JSON.stringify({
        x: lng,
        y: lat,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "ZONECLASS",
      returnGeometry: "false",
      f: "json",
    });
    const resp = await safeFetch(`${FTL_ZONING_QUERY}?${params}`, 15000);
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as {
      features?: { attributes: { ZONECLASS?: string } }[];
    };
    const zone = data.features?.[0]?.attributes?.ZONECLASS;
    return zone ? String(zone).trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Run tasks with bounded concurrency so a sync does not hammer the GIS host. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
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

/**
 * Archive priority when one address carries several permits. A building with an
 * active demolition permit is the archive's most urgent subject, so it must not
 * be displaced by a more recently submitted renovation at the same address.
 */
const HORIZON_PRIORITY: Record<string, number> = {
  IMMINENT: 0,
  "NEAR-TERM": 1,
  PROJECTED: 2,
  EXPIRED: 3,
};

/** Fetch one page of permits matching `where`, mapped to PermitRecords. */
async function fetchPermitPage(
  where: string,
  limit: number,
  timeoutMs = 45000,
): Promise<PermitRecord[]> {
  const out: PermitRecord[] = [];
  const params = new URLSearchParams({
    where,
    outFields:
      "CASEKEY,PERMITID,PERMITDESC,PERMITSTAT,SUBMITDT,APPROVEDT,FULLADDR,USECLASS,PARCELID",
    orderByFields: "SUBMITDT DESC",
    resultRecordCount: String(limit),
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  });

  const resp = await safeFetch(`${FTL_PERMITS_QUERY}?${params}`, timeoutMs);
  if (!resp.ok) {
    logger.warn({ status: resp.status }, "Broward permit API returned non-OK");
    return out;
  }

  const data = (await resp.json()) as {
    features?: ArcGisFeature[];
    error?: { message?: string };
  };
  if (data.error) {
    logger.warn({ error: data.error }, "Broward permit API returned an error");
    return out;
  }
  if (!data.features) return out;

  for (const feature of data.features) {
    const a = feature.attributes;
    const rawAddr = String(a.FULLADDR ?? "").trim();
    if (!rawAddr) continue;

    const address = normalizeAddress(rawAddr);
    if (!address) continue;

    // "…EST-…" case keys are pre-application estimates, not permits.
    const caseKey = String(a.CASEKEY ?? "");
    if (caseKey.includes("EST-")) continue;

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

    out.push({
      address: `${address}, Fort Lauderdale`,
      permitNo: caseKey || String(a.PERMITID ?? "UNKNOWN"),
      permitType,
      issueDate: formatDate(
        (a.APPROVEDT as number | null) ?? (a.SUBMITDT as number | null),
      ),
      workDescription,
      useClass,
      horizon: inferHorizon(permitType, status),
      latitude: feature.geometry?.y,
      longitude: feature.geometry?.x,
      folio: String(a.PARCELID ?? "").trim() || undefined,
    });
  }
  return out;
}

const CITY_SOURCES: CitySource[] = [
  {
    name: "Fort Lauderdale (Broward County ArcGIS)",
    fetch: async () => {
      let results: PermitRecord[] = [];
      try {
        const deadList = DEAD_STATUSES.map((s) => `'${s}'`).join(",");
        const base = [
          `PERMITSTAT NOT IN (${deadList})`,
          `PERMITSTAT IS NOT NULL`,
          `SUBMITDT >= DATE '2023-01-01'`,
        ].join(" AND ");

        const underwayList = [...UNDERWAY_STATUSES]
          .map((x) => `'${x}'`)
          .join(",");

        // Two queries. The recency window alone systematically misses active
        // demolitions, which are the archive's highest-priority subject: they
        // are few, and older than the most recent 100 submissions.
        // Sequential, not parallel: two concurrent 100-record queries against
        // the same ArcGIS host contend and time out. Each page is also isolated
        // so one slow response cannot zero out the entire sync.
        const page = async (where: string) => {
          try {
            return await fetchPermitPage(where, 100);
          } catch (err) {
            logger.warn({ err }, "Permit page fetch failed; continuing");
            return [] as PermitRecord[];
          }
        };

        const activeDemolitions = await page(
          `PERMITDESC = '${COMMERCIAL_DEMO_DESC}' AND PERMITSTAT IN (${underwayList}) AND ${base}`,
        );
        const recentWindow = await page(
          `PERMITDESC IN ('${COMMERCIAL_DEMO_DESC}','${COMMERCIAL_RENO_DESC}') AND ${base}`,
        );

        logger.info(
          {
            activeDemolitions: activeDemolitions.length,
            recentWindow: recentWindow.length,
          },
          "Fetched permit pages",
        );

        // Collapse to one record per address, keeping the highest archive
        // priority rather than the most recently submitted permit.
        const byAddress = new Map<string, PermitRecord>();
        for (const r of [...activeDemolitions, ...recentWindow]) {
          const existing = byAddress.get(r.address);
          if (
            !existing ||
            HORIZON_PRIORITY[r.horizon] < HORIZON_PRIORITY[existing.horizon]
          ) {
            byAddress.set(r.address, r);
          }
        }
        results = [...byAddress.values()];

        // Enrich from BCPA: square footage, year built and DOR use code.
        const parcels = await fetchParcels(
          results.map((r) => r.folio).filter((f): f is string => !!f),
        );

        const enriched: PermitRecord[] = [];
        let droppedNonPlaza = 0;

        for (const r of results) {
          const parcel = r.folio ? parcels.get(r.folio) : undefined;
          if (parcel && isExcludedUseCode(parcel.useCode)) {
            droppedNonPlaza++;
            continue;
          }
          const mapped = parcel?.useCode
            ? DOR_PLAZA_TYPES[parcel.useCode]
            : undefined;

          enriched.push({
            ...r,
            squareFootage: parcel?.squareFootage,
            yearBuilt: parcel?.yearBuilt,
            useCode: parcel?.useCode,
            useCodeLabel: mapped?.label,
            plazaType: mapped?.plazaType,
          });
        }

        if (droppedNonPlaza > 0) {
          logger.info(
            { droppedNonPlaza },
            "Dropped non-plaza parcels (residential, industrial, institutional, government)",
          );
        }

        // Resolve zoning district from the permit point, bounded concurrency.
        const zones = await mapLimit(enriched, 6, async (r) =>
          r.latitude != null && r.longitude != null
            ? await fetchZoning(r.latitude, r.longitude)
            : undefined,
        );
        enriched.forEach((r, i) => {
          r.zoningCode = zones[i];
        });

        results.length = 0;
        results.push(...enriched);
      } catch (err) {
        logger.warn({ err }, "Broward permit API fetch failed");
      }
      return results;
    },
  },
];

/**
 * Real Broward County commercial plaza records with active or completed
 * demolition / renovation permits. Every field below is a genuine source value:
 * permit case keys and dates from the Fort Lauderdale permit feed, square
 * footage / year built / use code from BCPA, zoning from the city zoning layer.
 * Used only to seed an empty database or when the live API is unreachable.
 */
const SAMPLE_PERMITS: PermitRecord[] = [
  {
    address: "1924 E SUNRISE BLVD, Fort Lauderdale",
    permitNo: "23CAP-00000-01BJM",
    permitType: "DEMOLITION",
    issueDate: "December 2023",
    workDescription: "COMMERCIAL DEMOLITION — PERMIT STATUS: ISSUED",
    horizon: "IMMINENT",
    latitude: 26.13648,
    longitude: -80.1208,
    folio: "504201190050",
    squareFootage: 7397,
    yearBuilt: 1953,
    useCode: "11",
    useCodeLabel: "Stores, one story",
    plazaType: "Single-Story Retail Strip",
    zoningCode: "B-1",
  },
  {
    address: "1923 CORDOVA RD, Fort Lauderdale",
    permitNo: "23CAP-00000-01E2E",
    permitType: "BUILDING",
    issueDate: "December 2023",
    workDescription: "COMMERCIAL ALTERATION / RENOVATION — PERMIT STATUS: OPEN",
    horizon: "NEAR-TERM",
    latitude: 26.09717,
    longitude: -80.13015,
    folio: "504212100010",
    squareFootage: 131032,
    yearBuilt: 2005,
    useCode: "16",
    useCodeLabel: "Community shopping center",
    plazaType: "Community Shopping Center",
    zoningCode: "PEDD",
  },
  {
    address: "2701 N FEDERAL HWY, Fort Lauderdale",
    permitNo: "23CAP-00000-01AD3",
    permitType: "BUILDING",
    issueDate: "December 2023",
    workDescription:
      "COMMERCIAL ALTERATION / RENOVATION — PERMIT STATUS: ISSUED",
    horizon: "NEAR-TERM",
    latitude: 26.16126,
    longitude: -80.1171,
    folio: "494224090010",
    squareFootage: 34716,
    yearBuilt: 1997,
    useCode: "11",
    useCodeLabel: "Stores, one story",
    plazaType: "Single-Story Retail Strip",
    zoningCode: "B-1",
  },
  {
    address: "5990 N FEDERAL HWY, Fort Lauderdale",
    permitNo: "23CAP-00000-01DIX",
    permitType: "BUILDING",
    issueDate: "December 2023",
    workDescription:
      "COMMERCIAL ALTERATION / RENOVATION — PERMIT STATUS: CORRECTIONS RECEIVED",
    horizon: "PROJECTED",
    latitude: 26.20223,
    longitude: -80.10843,
    folio: "494212000590",
    squareFootage: 11116,
    yearBuilt: 1972,
    useCode: "11",
    useCodeLabel: "Stores, one story",
    plazaType: "Single-Story Retail Strip",
    zoningCode: "B-1",
  },
  {
    address: "3950 N FEDERAL HWY, Fort Lauderdale",
    permitNo: "24CAP-00000-01KRQ",
    permitType: "DEMOLITION",
    issueDate: "November 2024",
    workDescription: "COMMERCIAL DEMOLITION — PERMIT STATUS: COMPLETE",
    horizon: "EXPIRED",
    latitude: 26.17738,
    longitude: -80.11912,
    folio: "494224080210",
    squareFootage: 3566,
    yearBuilt: 1960,
    useCode: "11",
    useCodeLabel: "Stores, one story",
    plazaType: "Single-Story Retail Strip",
    zoningCode: "B-1",
  },
  {
    address: "2775 E OAKLAND PARK BLVD, Fort Lauderdale",
    permitNo: "24CAP-00000-000YJ",
    permitType: "BUILDING",
    issueDate: "January 2024",
    workDescription:
      "COMMERCIAL ALTERATION / RENOVATION — PERMIT STATUS: COMPLETE",
    horizon: "EXPIRED",
    latitude: 26.1678,
    longitude: -80.10935,
    folio: "494224030020",
    squareFootage: 10122,
    yearBuilt: 1976,
    useCode: "11",
    useCodeLabel: "Stores, one story",
    plazaType: "Single-Story Retail Strip",
    zoningCode: "CB",
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

  const derivedStatus = statusForHorizon(permit.horizon);

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
