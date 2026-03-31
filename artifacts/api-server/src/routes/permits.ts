import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { surveysTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { geocodeAddress } from "../services/geocoder";
import { generateSurvey, type PermitRecord } from "../services/surveyGenerator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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
    workDescription: "REDEVELOPMENT OF EXISTING MERCANTILE PLAZA - TOTAL DEMOLITION AND REBUILD",
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
    address: "7600 N University Dr, Tamarac, FL",
    permitNo: "B-2023-005617",
    permitType: "BUILDING",
    issueDate: "August 2023",
    workDescription: "RENOVATION AND REDEVELOPMENT OF COMMERCIAL PLAZA",
    squareFootage: 22100,
    zoningCode: "B-2",
    horizon: "PROJECTED",
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
  {
    address: "2250 SW 32nd Ave, Miami, FL",
    permitNo: "B-2024-007123",
    permitType: "DEMOLITION",
    issueDate: "September 2024",
    workDescription: "COMPLETE DEMOLITION OF COMMERCIAL STRIP MALL",
    squareFootage: 6500,
    zoningCode: "BU-1",
    horizon: "IMMINENT",
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
};

async function addressExists(address: string): Promise<boolean> {
  const normalized = address.toLowerCase().trim();
  const rows = await db.select({ id: surveysTable.id }).from(surveysTable);
  return rows.some((r) => {
    const raw = r.id.toString();
    return raw === normalized;
  });
}

async function locationExists(location: string): Promise<boolean> {
  const rows = await db
    .select({ id: surveysTable.id })
    .from(surveysTable)
    .where(eq(surveysTable.location, `${location}, Miami-Dade County, Florida`))
    .limit(1);
  return rows.length > 0;
}

router.post("/permits/seed", async (req, res) => {
  try {
    let processed = 0;
    let errors = 0;
    let siteNum = await getNextSiteNum();

    for (const permit of SAMPLE_PERMITS) {
      try {
        const fullLocation = `${permit.address}, Miami-Dade County, Florida`;
        const exists = await locationExists(permit.address);
        if (exists) {
          logger.info({ address: permit.address }, "Skipping duplicate address");
          continue;
        }

        logger.info({ address: permit.address }, "Generating survey for sample permit");
        const survey = await generateSurvey(permit, siteNum);

        const geo = await geocodeAddress(permit.address);

        await db.insert(surveysTable).values({
          siteId: survey.siteId,
          plazaName: survey.plazaName,
          location: fullLocation,
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
          status: "ACTIVE",
          lastSyncedAt: new Date(),
          rawAddress: permit.address,
          squareFootage: permit.squareFootage ?? null,
          zoningCode: permit.zoningCode ?? null,
        });

        siteNum++;
        processed++;
      } catch (err) {
        logger.error({ err, address: permit.address }, "Failed to generate/insert survey");
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
    res.status(500).json({ success: false, message: "Seed operation failed", processed: 0, errors: 1 });
  }
});

router.post("/permits/sync", async (req, res) => {
  try {
    let processed = 0;
    let errors = 0;
    let siteNum = await getNextSiteNum();

    const FIVE_YEARS_AGO = new Date();
    FIVE_YEARS_AGO.setFullYear(FIVE_YEARS_AGO.getFullYear() - 5);
    const TWO_YEARS_AGO = new Date();
    TWO_YEARS_AGO.setFullYear(TWO_YEARS_AGO.getFullYear() - 2);

    const fiveYearsAgoStr = FIVE_YEARS_AGO.toISOString().slice(0, 10);
    const twoYearsAgoStr = TWO_YEARS_AGO.toISOString().slice(0, 10);

    const DEMOLITION_URL = `https://opendata.miamidade.gov/resource/rbng-6mha.json?$where=permit_type='DEMOLITION' AND (occupancy_code='MERCANTILE' OR occupancy_code='BUSINESS' OR occupancy_code='RETAIL') AND issue_date >= '${fiveYearsAgoStr}'&$limit=50`;
    const RENOVATION_URL = `https://opendata.miamidade.gov/resource/rbng-6mha.json?$where=permit_type='BUILDING' AND issue_date >= '${twoYearsAgoStr}' AND (occupancy_code='MERCANTILE' OR occupancy_code='BUSINESS' OR occupancy_code='RETAIL')&$limit=50`;

    let apiPermits: Array<{
      permit_number?: string;
      permit_type?: string;
      issue_date?: string;
      work_description?: string;
      address_line_1?: string;
      address_line_2?: string;
      city?: string;
      zip_code?: string;
    }> = [];

    try {
      const [demolResp, renovResp] = await Promise.allSettled([
        fetch(DEMOLITION_URL, { signal: AbortSignal.timeout(10000) }),
        fetch(RENOVATION_URL, { signal: AbortSignal.timeout(10000) }),
      ]);

      if (demolResp.status === "fulfilled" && demolResp.value.ok) {
        const data = await demolResp.value.json();
        if (Array.isArray(data)) apiPermits = apiPermits.concat(data.slice(0, 25));
      }
      if (renovResp.status === "fulfilled" && renovResp.value.ok) {
        const data = await renovResp.value.json();
        if (Array.isArray(data)) {
          const keywords = ["DEMOLISH", "TOTAL DEMOLITION", "RENOVATION", "REDEVELOPMENT", "REBUILD"];
          const filtered = (data as typeof apiPermits).filter((p) => {
            const desc = (p.work_description ?? "").toUpperCase();
            return keywords.some((k) => desc.includes(k));
          });
          apiPermits = apiPermits.concat(filtered.slice(0, 25));
        }
      }
    } catch (err) {
      logger.warn({ err }, "Miami-Dade API unreachable, falling back to sample data");
    }

    if (apiPermits.length === 0) {
      logger.info("No permits from API, seeding sample data");
      const existing = await db.select({ id: surveysTable.id }).from(surveysTable).limit(1);
      if (existing.length === 0) {
        for (const permit of SAMPLE_PERMITS) {
          try {
            const exists = await locationExists(permit.address);
            if (exists) continue;
            const survey = await generateSurvey(permit, siteNum);
            const geo = await geocodeAddress(permit.address);
            await db.insert(surveysTable).values({
              ...survey,
              location: `${permit.address}, Miami-Dade County, Florida`,
              latitude: geo?.lat ?? null,
              longitude: geo?.lng ?? null,
              status: "ACTIVE",
              lastSyncedAt: new Date(),
              rawAddress: permit.address,
              squareFootage: permit.squareFootage ?? null,
              zoningCode: permit.zoningCode ?? null,
            });
            siteNum++;
            processed++;
          } catch (err) {
            logger.error({ err }, "Error seeding fallback");
            errors++;
          }
        }
      }
    } else {
      for (const p of apiPermits) {
        try {
          const addrParts = [p.address_line_1, p.city].filter(Boolean);
          const address = addrParts.join(", ");
          if (!address) continue;

          const exists = await locationExists(address);
          if (exists) continue;

          const permitType = (p.permit_type ?? "BUILDING").toUpperCase();
          const issueDate = p.issue_date
            ? new Date(p.issue_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
            : "Unknown";

          let horizon: "IMMINENT" | "NEAR-TERM" | "PROJECTED" = "PROJECTED";
          if (permitType === "DEMOLITION") horizon = "IMMINENT";
          else {
            const desc = (p.work_description ?? "").toUpperCase();
            if (desc.includes("TOTAL DEMOLITION") || desc.includes("DEMOLISH")) horizon = "NEAR-TERM";
            else if (desc.includes("REDEVELOPMENT") || desc.includes("REBUILD")) horizon = "NEAR-TERM";
            else horizon = "PROJECTED";
          }

          const permit: PermitRecord = {
            address,
            permitNo: p.permit_number ?? `API-${Date.now()}`,
            permitType,
            issueDate,
            workDescription: p.work_description,
            horizon,
          };

          const survey = await generateSurvey(permit, siteNum);
          const geo = await geocodeAddress(address);

          await db.insert(surveysTable).values({
            ...survey,
            location: `${address}, Miami-Dade County, Florida`,
            latitude: geo?.lat ?? null,
            longitude: geo?.lng ?? null,
            status: "ACTIVE",
            lastSyncedAt: new Date(),
            rawAddress: address,
          });

          siteNum++;
          processed++;
        } catch (err) {
          logger.error({ err }, "Error processing API permit");
          errors++;
        }
      }
    }

    res.json({
      success: true,
      message: `Sync complete. Processed ${processed} new surveys with ${errors} errors.`,
      processed,
      errors,
    });
  } catch (err) {
    req.log.error({ err }, "Sync operation failed");
    res.status(500).json({ success: false, message: "Sync failed", processed: 0, errors: 1 });
  }
});

export default router;
