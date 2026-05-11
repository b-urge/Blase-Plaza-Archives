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
        .groupBy(surveysTable.demolitionHorizon),
      db
        .select({
          status: surveysTable.status,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(surveysTable)
        .groupBy(surveysTable.status),
      db
        .select({ lastSyncedAt: surveysTable.lastSyncedAt })
        .from(surveysTable)
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
      Active: 0,
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
    const { horizon, search, sortBy, sortDir } = req.query as {
      horizon?: string;
      search?: string;
      sortBy?: string;
      sortDir?: string;
    };

    let query = db.select().from(surveysTable).$dynamic();

    const conditions = [];
    if (horizon) {
      conditions.push(eq(surveysTable.demolitionHorizon, horizon));
    }
    if (search) {
      conditions.push(
        or(
          ilike(surveysTable.plazaName, `%${search}%`),
          ilike(surveysTable.location, `%${search}%`),
          ilike(surveysTable.siteId, `%${search}%`),
        ),
      );
    }
    if (conditions.length === 1) {
      query = query.where(conditions[0]);
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const orderDir = sortDir === "desc" ? desc : asc;
    if (sortBy === "plazaName") {
      query = query.orderBy(orderDir(surveysTable.plazaName));
    } else if (sortBy === "location") {
      query = query.orderBy(orderDir(surveysTable.location));
    } else if (sortBy === "surveyDate") {
      query = query.orderBy(orderDir(surveysTable.surveyDate));
    } else if (sortBy === "demolitionHorizon") {
      query = query.orderBy(orderDir(surveysTable.demolitionHorizon));
    } else if (sortBy === "siteId") {
      query = query.orderBy(orderDir(surveysTable.siteId));
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
