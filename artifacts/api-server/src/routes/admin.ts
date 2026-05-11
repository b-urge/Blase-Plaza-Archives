import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import { surveysTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

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
    const realStatus =
      survey.demolitionHorizon === "IMMINENT"
        ? "Demolition Pending"
        : survey.demolitionHorizon === "NEAR-TERM"
          ? "Renovation Pending"
          : survey.demolitionHorizon === "PROJECTED"
            ? "Declining"
            : "ACTIVE";
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
      const realStatus =
        survey.demolitionHorizon === "IMMINENT"
          ? "Demolition Pending"
          : survey.demolitionHorizon === "NEAR-TERM"
            ? "Renovation Pending"
            : survey.demolitionHorizon === "PROJECTED"
              ? "Declining"
              : "ACTIVE";
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
