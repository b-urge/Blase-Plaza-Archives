/**
 * cron.ts — Nightly sync job for Blasé Plaza Archives
 *
 * HOW TO SET UP IN REPLIT:
 * 1. In Replit, go to the three-dot menu → "Add background worker"
 * 2. Set the run command to: npx tsx scripts/src/cron.ts
 * 3. Enable "Always On" in your Replit project settings
 */

const CRON_HOUR = parseInt(process.env.CRON_HOUR ?? "2", 10);
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error("[cron] ADMIN_PASSWORD secret not set");
  process.exit(1);
}

function msUntilNextRun(targetHour: number): number {
  const now = new Date();
  const next = new Date();
  next.setHours(targetHour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function runSync(): Promise<void> {
  console.log(`[cron] ${new Date().toISOString()} — Starting nightly sync`);
  try {
    const resp = await fetch(`${API_BASE_URL}/api/permits/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_PASSWORD}`,
      },
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[cron] Sync failed with status ${resp.status}: ${text}`);
      return;
    }

    const data = await resp.json();
    console.log(`[cron] Sync complete:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[cron] Sync error:`, err);
  }
}

async function scheduleLoop(): Promise<void> {
  const msUntilFirst = msUntilNextRun(CRON_HOUR);
  const hoursUntil = (msUntilFirst / 1000 / 60 / 60).toFixed(1);
  console.log(
    `[cron] Scheduled. Next sync at ${CRON_HOUR}:00 (in ~${hoursUntil}h)`,
  );

  await new Promise((resolve) => setTimeout(resolve, msUntilFirst));

  while (true) {
    await runSync();
    await new Promise((resolve) => setTimeout(resolve, 24 * 60 * 60 * 1000));
  }
}

scheduleLoop().catch((err) => {
  console.error("[cron] Fatal error:", err);
  process.exit(1);
});
