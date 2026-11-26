#!/usr/bin/env node
/**
 * Container healthcheck without curl or wget (Railpack images ship only
 * node): GET http://127.0.0.1:$PORT<path>, exit 0 when the status is below
 * 500, else 1 — also on a timeout or a refused connection.
 *
 *   node /app/tooling/deploy/healthcheck.mjs              # marketing, docs: /
 *   node /app/tooling/deploy/healthcheck.mjs /api/version # saas
 *
 * Plain arguments only, so it fits Coolify's "cmd" healthcheck field.
 */
const TIMEOUT_MS = 5_000;

const path = process.argv[2] ?? "/";
const port = process.env.PORT || "3000";
const url = `http://127.0.0.1:${port}${path.startsWith("/") ? path : `/${path}`}`;

try {
	const res = await fetch(url, {
		redirect: "manual",
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (res.status < 500) process.exit(0);
	process.stderr.write(`[healthcheck] ${url} → ${res.status}\n`);
} catch (err) {
	process.stderr.write(`[healthcheck] ${url} → ${err.message}\n`);
}
process.exit(1);
