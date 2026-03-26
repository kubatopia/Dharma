// Polls /api/gmail/poll every 2 minutes to check for scheduling emails.
// Run alongside the dev server: npm run poll
//
// Reads CRON_SECRET and NEXTAUTH_URL from .env automatically.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

// Parse .env manually (no dotenv dep needed)
const env = {};
try {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*"?([^"#\n]*)"?\s*$/);
    if (match) env[match[1]] = match[2].trim();
  }
} catch {
  console.error("Could not read .env — make sure you run this from apps/web");
  process.exit(1);
}

const CRON_SECRET = env.CRON_SECRET;
const BASE_URL = env.NEXTAUTH_URL || "http://localhost:3002";
const INTERVAL_MS = 30 * 1000; // 30 seconds

if (!CRON_SECRET) {
  console.error("CRON_SECRET is not set in .env — add it and restart");
  process.exit(1);
}

async function poll() {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/gmail/poll`, {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const data = await res.json();
    const elapsed = Date.now() - start;

    if (!res.ok) {
      console.error(`[poller] ${new Date().toISOString()} — HTTP ${res.status}:`, data);
      return;
    }

    const drafts = data.results?.reduce((sum, r) => sum + (r.draftsCreated ?? 0), 0) ?? 0;
    console.log(
      `[poller] ${new Date().toISOString()} — polled ${data.polled ?? 0} account(s), ${drafts} draft(s) created (${elapsed}ms)`
    );
  } catch (err) {
    console.error(`[poller] ${new Date().toISOString()} — fetch failed:`, err.message);
  }
}

console.log(`[poller] Starting — polling ${BASE_URL}/api/gmail/poll every 30 seconds`);
poll(); // run immediately on start
setInterval(poll, INTERVAL_MS);
