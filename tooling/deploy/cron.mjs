#!/usr/bin/env node
/**
 * Triggers the saas cron endpoint from inside its own container (Railpack
 * images ship only node — no curl or wget): POST
 * http://127.0.0.1:$PORT/api/cron with `Authorization: Bearer $CRON_SECRET`.
 * Exit 0 on a 2xx, else 1.
 *
 *   node /app/tooling/deploy/cron.mjs
 *
 * No arguments and no quoting, so it fits a Coolify scheduled task. Schedule
 * it every minute; the endpoint runs only the jobs that are due.
 */
const TIMEOUT_MS = 60_000;

const secret = process.env.CRON_SECRET;
if (!secret) {
	process.stderr.write("[cron] CRON_SECRET is not set\n");
	process.exit(1);
}
const url = `http://127.0.0.1:${process.env.PORT || "3000"}/api/cron`;

try {
	const res = await fetch(url, {
		method: "POST",
		headers: { authorization: `Bearer ${secret}` },
		redirect: "manual",
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (res.ok) process.exit(0);
	process.stderr.write(`[cron] ${url} → ${res.status}\n`);
} catch (err) {
	process.stderr.write(`[cron] ${url} → ${err.message}\n`);
}
process.exit(1);
