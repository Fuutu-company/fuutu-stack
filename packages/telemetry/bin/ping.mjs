#!/usr/bin/env node
/**
 * Build-time telemetry ping.
 *
 * Invoked from the root `prebuild` script. Standalone (no TS imports)
 * so it runs under bare Node without a transpile step. The payload
 * mirrors `packages/telemetry/src/ping.ts` with `kind: "build"` — license
 * compliance only, exactly the fields of LICENSE.md §7 (tests enforce it).
 *
 * Non-blocking: 5 s timeout, silent on failure, always exits 0.
 * Only sent from CI (`CI` truthy) or a production build
 * (`NODE_ENV=production`) — never from a plain local build on a developer
 * machine.
 * Opt-out: `FUUTU_TELEMETRY_DISABLED=1`.
 * Endpoint override: `FUUTU_TELEMETRY_ENDPOINT`.
 */
import { createHash } from "node:crypto";

const KIT_NAME = "Fuutu-Stack";
const KIT_VERSION = "1.0.0";
const DEFAULT_ENDPOINT = "https://app.fuutustack.com/api/telemetry/ping";
const TIMEOUT_MS = 5_000;

function hashKey(key) {
	const trimmed = (key ?? "").trim();
	if (!trimmed) return "oss";
	return createHash("sha256").update(trimmed).digest("hex").slice(0, 32);
}

const disabled = ["1", "true"].includes(
	(process.env.FUUTU_TELEMETRY_DISABLED ?? "").toLowerCase(),
);

const ci = !["", "0", "false"].includes((process.env.CI ?? "").toLowerCase());
const production = process.env.NODE_ENV === "production";

if (disabled || !(ci || production)) {
	process.exit(0);
}

const payload = {
	kitName: KIT_NAME,
	kitVersion: KIT_VERSION,
	licenseKeyHash: hashKey(process.env.FUUTU_LICENSE_KEY),
	appUrl: process.env.NEXT_PUBLIC_SAAS_URL || null,
	kind: "build",
};

const endpoint = process.env.FUUTU_TELEMETRY_ENDPOINT ?? DEFAULT_ENDPOINT;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

try {
	await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Framework": `${KIT_NAME}/${KIT_VERSION}`,
		},
		body: JSON.stringify(payload),
		signal: controller.signal,
		// Never follow redirects — a 307/308 would re-POST the payload
		// to the redirect target's host.
		redirect: "error",
	});
} catch {
	// best-effort, swallow
} finally {
	clearTimeout(timer);
}

process.exit(0);
