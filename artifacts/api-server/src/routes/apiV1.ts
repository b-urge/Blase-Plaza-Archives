import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { surveysTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Public read-only API. Deliberately unauthenticated: /api/surveys already
 * serves the same records without a key, so requiring one here gated a side
 * door while the front door stood open. Unreviewed entries are excluded from
 * both.
 */
const router: IRouter = Router();

function formatSurvey(s: typeof surveysTable.$inferSelect) {
  return {
    site_id: s.siteId,
    plaza_name: s.plazaName,
    location: s.location,
    survey_date: s.surveyDate,
    demolition_horizon: s.demolitionHorizon,
    status: s.status,
    classification: {
      type: s.plazaType,
      architectural_style: s.architecturalStyle,
    },
    environmental_metrics: {
      parking_entropy: s.parkingEntropy,
      shade_coverage: s.shadeCoverage,
      signage_density: s.signageDensity,
      vacancy_ratio: s.vacancyRatio,
      pedestrian_activity: s.pedestrianActivity,
    },
    field_notes: s.reportText,
    permit_reference: {
      permit_no: s.permitNo,
      permit_type: s.permitType,
      issue_date: s.permitIssueDate,
      document_ref: s.documentRef,
    },
    coordinates:
      s.latitude && s.longitude
        ? { latitude: s.latitude, longitude: s.longitude }
        : null,
  };
}

router.get("/v1/plazas", async (req, res) => {
  try {
    const {
      horizon,
      classification,
      limit: limitStr,
      offset: offsetStr,
    } = req.query;

    const limit = Math.min(parseInt(limitStr as string) || 100, 100);
    const offset = parseInt(offsetStr as string) || 0;

    // Unreviewed entries are not published through the public API.
    let rows = await db
      .select()
      .from(surveysTable)
      .where(eq(surveysTable.pendingReview, false));

    if (horizon) {
      rows = rows.filter(
        (r) => r.demolitionHorizon === (horizon as string).toUpperCase(),
      );
    }
    if (classification) {
      rows = rows.filter((r) =>
        r.plazaType
          .toLowerCase()
          .includes((classification as string).toLowerCase()),
      );
    }

    const total = rows.length;
    const paginated = rows.slice(offset, offset + limit);

    res.json({
      total,
      limit,
      offset,
      records: paginated.map(formatSurvey),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/plazas failed");
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Internal server error" });
  }
});

router.get("/v1/plazas/:site_id", async (req, res) => {
  try {
    const { site_id } = req.params;
    const rows = await db
      .select()
      .from(surveysTable)
      .where(
        and(
          eq(surveysTable.siteId, site_id),
          eq(surveysTable.pendingReview, false),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: `No record found for site_id: ${site_id}`,
      });
      return;
    }

    res.json(formatSurvey(rows[0]));
  } catch (err) {
    logger.error({ err }, "GET /api/v1/plazas/:site_id failed");
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Internal server error" });
  }
});

export default router;
