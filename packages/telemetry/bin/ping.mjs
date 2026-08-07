#!/usr/bin/env node
/**
 * Build-time telemetry ping.
 *
 * Invoked from the root `prebuild` script. Standalone (no TS imports)
 * so it runs under bare Node without a transpile step. The payload
 * shape mirrors `packages/telemetry/src/ping.ts` — keep them in sync.
 *
 * Non-blocking: 5 s timeout, silent on failure, always exits 0.
 * Opt-out: `FUUTU_TELEMETRY_DISABLED=1`.
 * Endpoint override: `FUUTU_TELEMETRY_ENDPOINT`.
 */
import { createHash } from "node:crypto";

const KIT_NAME = "Fuutu-Stack";
const KIT_VERSION = "1.0.0";
const DEFAULT_ENDPOINT = "https://stackapp.fuutu.com/api/telemetry/ping";
const TIMEOUT_MS = 5_000;

function hashKey(key) {
	const trimmed = (key ?? "").trim();
	if (!trimmed) return "oss";
	return createHash("sha256").update(trimmed).digest("hex").slice(0, 32);
}

const disabled = ["1", "true"].includes(
	(process.env.FUUTU_TELEMETRY_DISABLED ?? "").toLowerCase(),
);

if (disabled) {
	process.exit(0);
}

const payload = {
	kitName: KIT_NAME,
	kitVersion: KIT_VERSION,
	licenseKeyHash: hashKey(process.env.FUUTU_LICENSE_KEY),
	appUrl: process.env.NEXT_PUBLIC_SAAS_URL ?? null,
	nodeVersion: process.version,
	platform: process.platform,
	// Build-time: we cannot read `config.features` without a TS transpile
	// step, so we ship an empty list and let the runtime `pingTelemetry()`
	// (called from boot/admin paths) carry the authoritative feature
	// snapshot. Inventing a static list here would falsify telemetry
	// (LICENSE.md §7).
	features: [],
	sentAt: new Date().toISOString(),
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
	});
} catch {
	// best-effort, swallow
} finally {
	clearTimeout(timer);
}

process.exit(0);
