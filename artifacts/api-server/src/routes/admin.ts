import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import { surveysTable } from "@workspace/db/schema";
import { eq, and, notLike, count, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { statusForHorizon } from "./permits";

const router: IRouter = Router();

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    res.status(500).send("ADMIN_PASSWORD secret not set");
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  if (token !== adminPassword) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.get("/admin/pending", adminAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(surveysTable)
      .where(eq(surveysTable.pendingReview, true));
    res.json({
      count: rows.length,
      surveys: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch pending surveys");
    res.status(500).json({ error: "Failed to fetch pending surveys" });
  }
});

router.post("/admin/approve/:id", adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const rows = await db
      .select()
      .from(surveysTable)
      .where(and(eq(surveysTable.id, id), eq(surveysTable.pendingReview, true)))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "Pending survey not found" });
      return;
    }
    const survey = rows[0];
    const realStatus = statusForHorizon(survey.demolitionHorizon);
    await db
      .update(surveysTable)
      .set({ pendingReview: false, status: realStatus, reviewedAt: new Date() })
      .where(eq(surveysTable.id, id));
    res.json({
      success: true,
      message: `Survey ${id} approved and set to "${realStatus}"`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to approve survey");
    res.status(500).json({ error: "Failed to approve survey" });
  }
});

router.post("/admin/reject/:id", adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const rows = await db
      .select({ id: surveysTable.id })
      .from(surveysTable)
      .where(and(eq(surveysTable.id, id), eq(surveysTable.pendingReview, true)))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "Pending survey not found" });
      return;
    }
    await db.delete(surveysTable).where(eq(surveysTable.id, id));
    res.json({ success: true, message: `Survey ${id} rejected and deleted` });
  } catch (err) {
    logger.error({ err }, "Failed to reject survey");
    res.status(500).json({ error: "Failed to reject survey" });
  }
});

router.post("/admin/approve-all", adminAuth, async (req, res) => {
  try {
    const pending = await db
      .select()
      .from(surveysTable)
      .where(eq(surveysTable.pendingReview, true));
    let approved = 0;
    for (const survey of pending) {
      const realStatus = statusForHorizon(survey.demolitionHorizon);
      await db
        .update(surveysTable)
        .set({
          pendingReview: false,
          status: realStatus,
          reviewedAt: new Date(),
        })
        .where(eq(surveysTable.id, survey.id));
      approved++;
    }
    res.json({ success: true, message: `Approved ${approved} surveys` });
  } catch (err) {
    logger.error({ err }, "Failed to bulk approve");
    res.status(500).json({ error: "Failed to bulk approve" });
  }
});

/**
 * Every Broward-era record has a location ending in "Broward County, Florida"
 * (built in routes/permits.ts). Anything else is a legacy Miami-Dade survey from
 * before the county pivot, so this pattern identifies legacy rows without
 * depending on the exact old wording.
 */
const BROWARD_LOCATION_PATTERN = "%Broward County, Florida";

function legacyFilter() {
  return notLike(surveysTable.location, BROWARD_LOCATION_PATTERN);
}

/** Preview which records are legacy (non-Broward) without deleting anything. */
router.get("/admin/legacy", adminAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: surveysTable.id,
        siteId: surveysTable.siteId,
        plazaName: surveysTable.plazaName,
        location: surveysTable.location,
        sourceCity: surveysTable.sourceCity,
      })
      .from(surveysTable)
      .where(legacyFilter());

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(surveysTable);

    res.json({
      legacyCount: rows.length,
      totalCount: total,
      wouldRemain: total - rows.length,
      surveys: rows,
    });
  } catch (err) {
    logger.error({ err }, "Failed to list legacy surveys");
    res.status(500).json({ error: "Failed to list legacy surveys" });
  }
});

/**
 * Delete surveys.
 *
 * ?scope=legacy (default) removes pre-pivot, non-Broward records.
 * ?scope=all removes every record — used to rebuild the archive after a
 * change to the classification logic, since the sync skips addresses that
 * already exist and therefore cannot correct an existing entry.
 *
 * Dry run by default; pass ?confirm=true to actually delete. Destructive and
 * irreversible, so both the scope and the confirmation are explicit opt-ins.
 */
router.post("/admin/purge-legacy", adminAuth, async (req, res) => {
  try {
    const confirmed = req.query.confirm === "true";
    const scopeAll = req.query.scope === "all";
    const filter = scopeAll ? undefined : legacyFilter();

    const doomed = await (filter
      ? db
          .select({
            id: surveysTable.id,
            plazaName: surveysTable.plazaName,
            location: surveysTable.location,
          })
          .from(surveysTable)
          .where(filter)
      : db
          .select({
            id: surveysTable.id,
            plazaName: surveysTable.plazaName,
            location: surveysTable.location,
          })
          .from(surveysTable));

    if (!confirmed) {
      res.json({
        dryRun: true,
        scope: scopeAll ? "all" : "legacy",
        wouldDelete: doomed.length,
        message: `Dry run: ${doomed.length} ${scopeAll ? "" : "legacy "}survey(s) would be deleted. Re-send with ?confirm=true to proceed.`,
        samples: doomed.slice(0, 10),
      });
      return;
    }

    if (doomed.length === 0) {
      res.json({
        success: true,
        deleted: 0,
        message: "No matching surveys found. Nothing to delete.",
      });
      return;
    }

    if (filter) {
      await db.delete(surveysTable).where(filter);
    } else {
      await db.delete(surveysTable);
    }
    logger.warn(
      { deleted: doomed.length, scope: scopeAll ? "all" : "legacy" },
      "Purged surveys",
    );

    res.json({
      success: true,
      deleted: doomed.length,
      message: `Deleted ${doomed.length} ${scopeAll ? "" : "legacy "}survey(s). Run POST /api/permits/sync to repopulate from Broward County permit data.`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to purge legacy surveys");
    res.status(500).json({ error: "Failed to purge legacy surveys" });
  }
});

/**
 * Rejoin bullet characters that were stored on their own line.
 *
 * Earlier reports were generated under a system prompt that said bullets must
 * use "the literal • character on their own line", which the model took
 * literally and emitted as "•\ntext". The prompt and a generation-time
 * normaliser now prevent this; this repairs records already in the database
 * without regenerating them.
 *
 * Dry run by default; pass ?confirm=true to write.
 */
const BULLET_BREAK = /^[ \t]*•[ \t]*\r?\n[ \t]*/gm;

router.post("/admin/repair-bullets", adminAuth, async (req, res) => {
  try {
    const confirmed = req.query.confirm === "true";

    const rows = await db
      .select({ id: surveysTable.id, reportText: surveysTable.reportText })
      .from(surveysTable);

    const broken = rows.filter((r) => {
      BULLET_BREAK.lastIndex = 0;
      return BULLET_BREAK.test(r.reportText);
    });

    if (!confirmed) {
      res.json({
        dryRun: true,
        scanned: rows.length,
        wouldRepair: broken.length,
        message: `Dry run: ${broken.length} of ${rows.length} report(s) have a line break after the bullet character. Re-send with ?confirm=true to repair.`,
      });
      return;
    }

    let repaired = 0;
    for (const row of broken) {
      const fixed = row.reportText.replace(BULLET_BREAK, "• ");
      if (fixed !== row.reportText) {
        await db
          .update(surveysTable)
          .set({ reportText: fixed })
          .where(eq(surveysTable.id, row.id));
        repaired++;
      }
    }

    logger.info(
      { repaired, scanned: rows.length },
      "Repaired bullet formatting",
    );
    res.json({
      success: true,
      scanned: rows.length,
      repaired,
      message: `Repaired ${repaired} report(s).`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to repair bullet formatting");
    res.status(500).json({ error: "Failed to repair bullet formatting" });
  }
});

/**
 * Renumber SITE ID to match the row id, so the number shown on a report equals
 * the number in its URL.
 *
 * SITE ID used to come from a counter that restarted at 1 on an empty table
 * while the id sequence kept climbing across rebuilds, so /report/64 displayed
 * "SITE ID: 01". New records take their number from the id sequence; this
 * realigns records created before that change.
 *
 * SITE ID also appears inside the generated report text and the document
 * reference, so both are rewritten to match. Runs in a transaction because
 * site_id is unique. Dry run by default; ?confirm=true writes.
 */
router.post("/admin/renumber-sites", adminAuth, async (req, res) => {
  try {
    const confirmed = req.query.confirm === "true";

    const rows = await db
      .select({
        id: surveysTable.id,
        siteId: surveysTable.siteId,
        reportText: surveysTable.reportText,
        documentRef: surveysTable.documentRef,
      })
      .from(surveysTable)
      .orderBy(desc(surveysTable.id));

    const stale = rows.filter(
      (r) => r.siteId !== String(r.id).padStart(2, "0"),
    );

    if (!confirmed) {
      res.json({
        dryRun: true,
        scanned: rows.length,
        wouldRenumber: stale.length,
        message: `Dry run: ${stale.length} of ${rows.length} record(s) have a SITE ID that does not match their URL. Re-send with ?confirm=true to renumber.`,
        samples: stale.slice(0, 10).map((r) => ({
          id: r.id,
          from: r.siteId,
          to: String(r.id).padStart(2, "0"),
        })),
      });
      return;
    }

    let renumbered = 0;
    await db.transaction(async (tx) => {
      for (const row of stale) {
        const next = String(row.id).padStart(2, "0");
        const reportText = row.reportText.replace(
          /^SITE ID:[ \t]*\S+[ \t]*$/m,
          `SITE ID: ${next}`,
        );
        // Document refs look like BPA-2026-<siteId>-<4 digits>.
        const documentRef = row.documentRef.replace(
          /^(BPA-\d{4}-)[^-]+(-\d+)$/,
          `$1${next}$2`,
        );
        await tx
          .update(surveysTable)
          .set({ siteId: next, reportText, documentRef })
          .where(eq(surveysTable.id, row.id));
        renumbered++;
      }
    });

    logger.info({ renumbered }, "Renumbered SITE IDs to match row ids");
    res.json({
      success: true,
      scanned: rows.length,
      renumbered,
      message: `Renumbered ${renumbered} record(s).`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to renumber site ids");
    res.status(500).json({ error: "Failed to renumber site ids" });
  }
});

router.get("/admin", async (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BPA Admin</title>
  <style>
    body { font-family: monospace; background: #0a0a0a; color: #c8c8c8; padding: 2rem; }
    h1 { color: #e8e8e8; letter-spacing: 0.1em; font-size: 1rem; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 1rem; }
    th { text-align: left; border-bottom: 1px solid #333; padding: 0.5rem 0.75rem; color: #888; text-transform: uppercase; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #1a1a1a; vertical-align: top; }
    tr:hover td { background: #111; }
    .btn-approve { background: none; border: 1px solid #4a7a4a; color: #6aaa6a; padding: 0.25rem 0.6rem; cursor: pointer; font-family: monospace; margin-right: 0.4rem; }
    .btn-reject { background: none; border: 1px solid #7a4a4a; color: #aa6a6a; padding: 0.25rem 0.6rem; cursor: pointer; font-family: monospace; }
    .btn-bulk { background: none; border: 1px solid #888; color: #aaa; padding: 0.4rem 1rem; cursor: pointer; font-family: monospace; margin-right: 0.5rem; margin-bottom: 1rem; }
    .btn-danger { border-color: #7a4a4a; color: #aa6a6a; }
    .msg { color: #6aaa6a; margin-top: 1rem; font-size: 0.8rem; min-height: 1.2em; }
    #loading { color: #888; }
    #content { display: none; }
  </style>
</head>
<body>
  <h1>// BLASÉ PLAZA ARCHIVES — REVIEW QUEUE</h1>
  <div id="loading">Authenticating...</div>
  <div id="content">
    <div>
      <button class="btn-bulk" onclick="approveAll()">✓ Approve All</button>
      <button class="btn-bulk" onclick="load()">↺ Refresh</button>
      <button class="btn-bulk" onclick="triggerSync()">⟳ Trigger Sync</button>
      <button class="btn-bulk btn-danger" onclick="purgeLegacy()">⌫ Purge Legacy (non-Broward)</button>
    </div>
    <div id="count" style="color:#888;font-size:0.85rem;margin-bottom:1rem;"></div>
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Plaza Name</th><th>Address</th><th>Source</th>
          <th>Horizon</th><th>Permit</th><th>Date</th><th>Actions</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
    <div class="msg" id="msg"></div>
  </div>
  <script>
    let token = localStorage.getItem("bpa_admin_token");
    if (!token) { token = prompt("Admin password:"); if (token) localStorage.setItem("bpa_admin_token", token); }
    if (!token) { document.getElementById("loading").textContent = "Access denied."; }
    else { load(); }

    async function api(method, path) {
      const r = await fetch(path, { method, headers: { Authorization: "Bearer " + token } });
      if (r.status === 401 || r.status === 403) { localStorage.removeItem("bpa_admin_token"); location.reload(); }
      return r.json();
    }

    async function load() {
      const d = await api("GET", "/api/admin/pending");
      document.getElementById("loading").style.display = "none";
      document.getElementById("content").style.display = "block";
      document.getElementById("count").textContent = d.count + " entries pending review";
      const tbody = document.getElementById("tbody");
      tbody.innerHTML = "";
      if (!d.surveys || d.surveys.length === 0) {
        tbody.innerHTML = "<tr><td colspan='8' style='color:#555;padding:2rem 0'>No entries pending review.</td></tr>";
        return;
      }
      for (const s of d.surveys) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td>" + s.id + "</td><td><strong>" + s.plazaName + "</strong></td><td>" + (s.rawAddress ?? s.location) + "</td><td>" + (s.sourceCity ?? "—") + "</td><td>" + s.demolitionHorizon + "</td><td>" + s.permitNo + "</td><td>" + s.permitIssueDate + "</td><td><button class='btn-approve' onclick='approve(" + s.id + ")'>✓ Approve</button><button class='btn-reject' onclick='reject(" + s.id + ")'>✗ Reject</button></td>";
        tbody.appendChild(tr);
      }
    }

    async function approve(id) {
      const d = await api("POST", "/api/admin/approve/" + id);
      document.getElementById("msg").textContent = d.message ?? d.error;
      load();
    }

    async function reject(id) {
      if (!confirm("Reject and delete?")) return;
      const d = await api("POST", "/api/admin/reject/" + id);
      document.getElementById("msg").textContent = d.message ?? d.error;
      load();
    }

    async function approveAll() {
      if (!confirm("Approve all pending entries?")) return;
      const d = await api("POST", "/api/admin/approve-all");
      document.getElementById("msg").textContent = d.message ?? d.error;
      load();
    }

    async function purgeLegacy() {
      // Always dry-run first so the operator sees exactly what will be destroyed.
      const preview = await api("POST", "/api/admin/purge-legacy");
      if (preview.error) { document.getElementById("msg").textContent = preview.error; return; }
      if (!preview.wouldDelete) {
        document.getElementById("msg").textContent = "No legacy (non-Broward) surveys found.";
        return;
      }
      const sample = (preview.samples || []).map(function (x) { return "  • " + x.location; }).join("\n");
      const ok = confirm(
        "PERMANENTLY DELETE " + preview.wouldDelete + " legacy (non-Broward) survey(s)?\n\n" +
        sample + (preview.wouldDelete > (preview.samples || []).length ? "\n  ..." : "") +
        "\n\nThis cannot be undone."
      );
      if (!ok) return;
      const d = await api("POST", "/api/admin/purge-legacy?confirm=true");
      document.getElementById("msg").textContent = d.message ?? d.error;
      load();
    }

    async function triggerSync() {
      document.getElementById("msg").textContent = "Syncing... this may take a minute.";
      const d = await api("POST", "/api/permits/sync");
      document.getElementById("msg").textContent = d.message ?? d.error;
      load();
    }
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

export default router;
