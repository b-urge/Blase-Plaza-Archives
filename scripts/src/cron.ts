/**
 * cron.ts — Nightly permit sync for Blasé Plaza Archives
 *
 * Queues newly-filed Broward County commercial demolition and renovation
 * permits for review. Entries land in `pending_review` and are NOT published;
 * approving them at /api/admin is always a manual step.
 *
 * SETUP — either works:
 *
 *   A. Scheduled Deployment (recommended — no always-on process)
 *      Deployment type: Scheduled
 *      Schedule:        0 2 * * *          (02:00 daily)
 *      Build:           pnpm install --frozen-lockfile
 *      Run:             pnpm --filter @workspace/scripts run sync
 *      Secrets:         API_BASE_URL, ADMIN_PASSWORD
 *
 *   B. Always-on background worker
 *      Run: pnpm --filter @workspace/scripts run cron
 *      Loops internally, syncing daily at CRON_HOUR.
 *
 * ENVIRONMENT
 *   API_BASE_URL     required in production, e.g. https://blaseplazas.com
 *   ADMIN_PASSWORD   required; must match the deployment's current secret
 *   CRON_HOUR        hour of day for mode B (default 2)
 *   SYNC_MAX_PASSES  how many sync passes per run (default 4)
 */

const CRON_HOUR = parseInt(process.env.CRON_HOUR ?? "2", 10);
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MAX_PASSES = parseInt(process.env.SYNC_MAX_PASSES ?? "4", 10);
const RUN_ONCE =
  process.argv.includes("--once") || process.env.RUN_ONCE === "true";

if (!ADMIN_PASSWORD) {
  console.error("[cron] ADMIN_PASSWORD is not set. Refusing to start.");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${ADMIN_PASSWORD}` };
const log = (msg: string) =>
  console.log(`[cron] ${new Date().toISOString()} ${msg}`);

/** Number of entries currently awaiting review, or null if unreachable. */
async function pendingCount(): Promise<number | null> {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/admin/pending`, {
      headers: auth,
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { count?: number };
    return typeof data.count === "number" ? data.count : null;
  } catch {
    return null;
  }
}

/**
 * Confirm the API is reachable and the password is current before syncing.
 * A rotated ADMIN_PASSWORD is the most likely reason for this job to break,
 * so it gets an explicit message rather than a generic failure.
 */
async function preflight(): Promise<boolean> {
  if (API_BASE_URL.includes("localhost")) {
    console.warn(
      `[cron] API_BASE_URL is ${API_BASE_URL}. In a deployment this should be the public URL, e.g. https://blaseplazas.com`,
    );
  }
  try {
    const resp = await fetch(`${API_BASE_URL}/api/admin/pending`, {
      headers: auth,
      signal: AbortSignal.timeout(30_000),
    });
    if (resp.status === 401 || resp.status === 403) {
      console.error(
        `[cron] Auth rejected (${resp.status}). ADMIN_PASSWORD does not match the deployment — it was probably rotated without updating this job's secret.`,
      );
      return false;
    }
    if (!resp.ok) {
      console.error(`[cron] API returned ${resp.status} at ${API_BASE_URL}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[cron] Cannot reach ${API_BASE_URL}:`, err);
    return false;
  }
}

/**
 * One sync pass. The hosting proxy terminates long requests well before the
 * server finishes, so a timeout here is expected and does NOT mean the sync
 * failed — the work continues server-side. Progress is measured by the
 * pending count, not by this response.
 */
async function syncPass(): Promise<void> {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/permits/sync`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { message?: string };
      log(`pass complete: ${data.message ?? "(no message)"}`);
    } else {
      log(
        `pass returned ${resp.status} (work may still be running server-side)`,
      );
    }
  } catch {
    log("pass request timed out (expected; work continues server-side)");
  }
}

/**
 * Sync is idempotent and skips addresses already present, so repeated passes
 * are safe and pick up wherever a truncated request left off. Stop as soon as
 * a pass adds nothing.
 */
async function runSync(): Promise<void> {
  log("starting sync");

  if (!(await preflight())) {
    log("preflight failed; aborting this run");
    return;
  }

  const before = await pendingCount();
  let previous = before ?? 0;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    await syncPass();
    const current = (await pendingCount()) ?? previous;
    const added = current - previous;
    log(`pass ${pass}/${MAX_PASSES}: queue ${previous} -> ${current}`);
    previous = current;
    if (added <= 0) break;
  }

  const total = previous;
  const queued = before === null ? total : total - before;
  log(
    `done. ${queued} newly queued, ${total} awaiting review at ${API_BASE_URL}/api/admin`,
  );
}

function msUntilNextRun(targetHour: number): number {
  const now = new Date();
  const next = new Date();
  next.setHours(targetHour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function main(): Promise<void> {
  if (RUN_ONCE) {
    await runSync();
    return;
  }

  const ms = msUntilNextRun(CRON_HOUR);
  log(
    `scheduled: next sync at ${CRON_HOUR}:00 (in ~${(ms / 3_600_000).toFixed(1)}h)`,
  );
  await new Promise((r) => setTimeout(r, ms));

  for (;;) {
    await runSync();
    await new Promise((r) => setTimeout(r, 24 * 60 * 60 * 1000));
  }
}

main().catch((err) => {
  console.error("[cron] fatal:", err);
  process.exit(1);
});
