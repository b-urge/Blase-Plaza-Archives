import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { surveysTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, asc, sql, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/surveys/stats", async (req, res) => {
  try {
    const [totals, statusTotals, lastUpdated] = await Promise.all([
      db
        .select({
          demolitionHorizon: surveysTable.demolitionHorizon,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(surveysTable)
        .where(eq(surveysTable.pendingReview, false))
        .groupBy(surveysTable.demolitionHorizon),
      db
        .select({
          status: surveysTable.status,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(surveysTable)
        .where(eq(surveysTable.pendingReview, false))
        .groupBy(surveysTable.status),
      db
        .select({ lastSyncedAt: surveysTable.lastSyncedAt })
        .from(surveysTable)
        .where(eq(surveysTable.pendingReview, false))
        .orderBy(desc(surveysTable.lastSyncedAt))
        .limit(1),
    ]);

    const byHorizon: Record<string, number> = {
      IMMINENT: 0,
      "NEAR-TERM": 0,
      PROJECTED: 0,
      EXPIRED: 0,
    };
    const byStatus: Record<string, number> = {
      Declining: 0,
      "Renovation Pending": 0,
      "Demolition Pending": 0,
      "Post-Intervention": 0,
    };
    let total = 0;
    for (const row of totals) {
      byHorizon[row.demolitionHorizon] =
        (byHorizon[row.demolitionHorizon] ?? 0) + row.count;
      total += row.count;
    }
    for (const row of statusTotals) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + row.count;
    }

    res.json({
      total,
      byHorizon,
      byStatus,
      lastUpdated: lastUpdated[0]?.lastSyncedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/surveys", async (req, res) => {
  try {
    const { horizon, search, sortBy, sortDir, from, to } = req.query as {
      horizon?: string;
      search?: string;
      sortBy?: string;
      sortDir?: string;
      from?: string;
      to?: string;
    };

    let query = db.select().from(surveysTable).$dynamic();

    // Entries awaiting review are staged, not published. They are visible only
    // through /api/admin/pending until an admin approves them.
    const conditions = [eq(surveysTable.pendingReview, false)];

    // Permit date, falling back to parsing the display string for records
    // created before permit_date existed. Matches the sort expression below.
    const permitDay = sql`COALESCE(${surveysTable.permitDate}::date, CASE WHEN ${surveysTable.surveyDate} ~ '^[A-Za-z]+ [0-9]{4}$' THEN to_date(${surveysTable.surveyDate}, 'Month YYYY') END)`;

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      conditions.push(sql`${permitDay} >= ${from}::date`);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      conditions.push(sql`${permitDay} <= ${to}::date`);
    }
    if (horizon) {
      conditions.push(eq(surveysTable.demolitionHorizon, horizon));
    }
    if (search) {
      // or() is typed as possibly-undefined; only push a real condition.
      const searchCondition = or(
        ilike(surveysTable.plazaName, `%${search}%`),
        ilike(surveysTable.location, `%${search}%`),
        ilike(surveysTable.siteId, `%${search}%`),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (conditions.length === 1) {
      query = query.where(conditions[0]);
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const orderDir = sortDir === "desc" ? desc : asc;
    const descending = sortDir === "desc";

    if (sortBy === "plazaName") {
      query = query.orderBy(orderDir(surveysTable.plazaName));
    } else if (sortBy === "location") {
      query = query.orderBy(orderDir(surveysTable.location));
    } else if (sortBy === "surveyDate") {
      // survey_date is text like "December 2023", so a plain sort orders it
      // alphabetically by month name. Parse it to a real date instead, and
      // tolerate values that are not in that shape.
      const parsed = sql`COALESCE(${surveysTable.permitDate}::date, CASE WHEN ${surveysTable.surveyDate} ~ '^[A-Za-z]+ [0-9]{4}$' THEN to_date(${surveysTable.surveyDate}, 'Month YYYY') END)`;
      query = query.orderBy(
        descending
          ? sql`${parsed} DESC NULLS LAST`
          : sql`${parsed} ASC NULLS LAST`,
      );
    } else if (sortBy === "demolitionHorizon") {
      // Alphabetical order would lead with EXPIRED. Order by urgency instead,
      // which is what the column means.
      const urgency = sql`CASE ${surveysTable.demolitionHorizon} WHEN 'IMMINENT' THEN 0 WHEN 'NEAR-TERM' THEN 1 WHEN 'PROJECTED' THEN 2 WHEN 'EXPIRED' THEN 3 ELSE 4 END`;
      query = query.orderBy(
        descending ? sql`${urgency} DESC` : sql`${urgency} ASC`,
      );
    } else if (sortBy === "siteId") {
      // site_id is text, so it sorts "100" before "64". It now mirrors the row
      // id, which is an integer, so order by that.
      query = query.orderBy(orderDir(surveysTable.id));
    } else {
      query = query.orderBy(asc(surveysTable.id));
    }

    const rows = await query;
    res.json(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch surveys");
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
});

router.get("/surveys/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const rows = await db
      .select()
      .from(surveysTable)
      .where(eq(surveysTable.id, id))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "Survey not found" });
      return;
    }
    const r = rows[0];
    res.json({
      ...r,
      createdAt: r.createdAt.toISOString(),
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch survey");
    res.status(500).json({ error: "Failed to fetch survey" });
  }
});

export default router;
