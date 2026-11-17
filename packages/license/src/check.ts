import { KIT_NAME, KIT_VERSION } from "@fuutu/config";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { hashLicenseKey } from "./hash";
import type { CheckLicenseOptions, LicenseMode, LicenseStatus } from "./types";

const log = createLogger({ scope: "license" });

const DEFAULT_ENDPOINT = "https://app.fuutustack.com/api/license/validate";
const DEFAULT_TIMEOUT_MS = 5_000;
/** In-memory cache TTL — long enough that hot paths don't re-hit the
 *  validator, short enough that a freshly-purchased key starts working
 *  on the next process restart. */
const CACHE_TTL_MS = 60 * 60 * 1_000;
/** Failures get a short TTL — a transient boot blip must not pin
 *  `mode: "oss"` for the full hour, while still damping a dead validator. */
const FAILURE_TTL_MS = 5 * 60 * 1_000;

let cached: { at: number; status: LicenseStatus; ttlMs: number } | null = null;
/**
 * Last paid status the endpoint confirmed. A validator outage (429, 5xx,
 * network) keeps it for the same key instead of downgrading to `oss`;
 * only a definitive answer (401/403, invalid body) ends it.
 */
let lastValidated: LicenseStatus | null = null;

/**
 * Validate the configured Fuutu license key against the Fuutu license
 * endpoint.
 *
 * **Placeholder behaviour (v1):** the validation endpoint is not yet
 * publicly hosted by Fuutu. This function is therefore designed to fail
 * **soft** — any network error, 4xx, 5xx, malformed payload or missing
 * configuration falls back to `mode: "oss"` and never throws. Once a key
 * validated, a 429, 5xx or network error keeps that status (re-checked
 * after `Retry-After`, else the short failure TTL). The kit
 * stays fully functional in OSS mode while the production validation
 * service is being built.
 *
 * Once the endpoint goes live the contract it must implement is:
 *
 *   POST {endpoint}
 *   { "key": "<raw license key>", "kitName": "Fuutu-Stack", "kitVersion": "..." }
 *
 *   200 OK  → { "mode": "mcp" | "enterprise", "valid": true }
 *   401 / 403 → { "valid": false, "reason": "..." }
 *
 * The result cache is global — not keyed on key or endpoint. Intended
 * callers are the boot warm-up and admin diagnostics; passing different
 * options per call still returns the cached status until it expires.
 */
export async function checkLicense(
	options: CheckLicenseOptions = {},
): Promise<LicenseStatus> {
	const now = Date.now();
	if (!options.force && cached && now - cached.at < cached.ttlMs) {
		return cached.status;
	}

	// `||` (not `??`) — an explicitly passed "" must fall back to the
	// configured env key, not short-circuit to OSS mode. `.trim()` runs
	// per operand so a whitespace-only override falls back the same way
	// instead of winning the `||` and trimming to "".
	const licenseKey =
		(options.licenseKey || "").trim() || (env.FUUTU_LICENSE_KEY || "").trim();
	const licenseKeyHash = hashLicenseKey(licenseKey);

	// No key configured → OSS mode. This is a legitimate, supported state
	// under LICENSE.md §3 (Eligible Users). Do not call the endpoint.
	if (!licenseKey) {
		const status: LicenseStatus = {
			mode: "oss",
			valid: true,
			checkedAt: new Date(now).toISOString(),
			licenseKeyHash,
		};
		cached = { at: now, status, ttlMs: CACHE_TTL_MS };
		return status;
	}

	const endpoint =
		options.endpoint ?? env.FUUTU_LICENSE_ENDPOINT ?? DEFAULT_ENDPOINT;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	try {
		// AbortSignal.timeout governs the full round-trip including the
		// body read — a manual AbortController cleared in .finally only
		// covers until headers arrive.
		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: licenseKey,
				kitName: KIT_NAME,
				kitVersion: KIT_VERSION,
			}),
			signal: AbortSignal.timeout(timeoutMs),
			// Never follow redirects — a 307/308 would re-POST the raw
			// license key to the redirect target's host.
			redirect: "error",
		});

		if (res.status === 429 || res.status >= 500) {
			return unavailable(
				licenseKeyHash,
				now,
				`HTTP ${res.status}`,
				retryAfterMs(res.headers.get("retry-after"), now),
			);
		}
		if (!res.ok) {
			return fallback(licenseKeyHash, now, `HTTP ${res.status}`);
		}

		const body = (await res.json().catch(() => null)) as {
			mode?: string;
			valid?: boolean;
			reason?: string;
		} | null;

		// Contract: 200 → { valid: true, mode: "mcp" | "enterprise" }.
		// Anything else — including a contradictory "oss" — is invalid.
		if (
			body?.valid !== true ||
			(body.mode !== "mcp" && body.mode !== "enterprise")
		) {
			return fallback(
				licenseKeyHash,
				now,
				typeof body?.reason === "string" ? body.reason : "invalid response",
			);
		}

		const status: LicenseStatus = {
			mode: body.mode,
			valid: true,
			checkedAt: new Date(now).toISOString(),
			licenseKeyHash,
		};
		cached = { at: now, status, ttlMs: CACHE_TTL_MS };
		lastValidated = status;
		return status;
	} catch (err) {
		const reason = err instanceof Error ? err.message : "network error";
		return unavailable(licenseKeyHash, now, reason, undefined);
	}
}

/** `Retry-After` (seconds or HTTP date) in ms, capped at the success TTL. */
function retryAfterMs(header: string | null, now: number): number | undefined {
	if (!header) return undefined;
	const seconds = Number(header);
	const ms = Number.isFinite(seconds)
		? seconds * 1_000
		: Date.parse(header) - now;
	if (!Number.isFinite(ms) || ms <= 0) return undefined;
	return Math.min(ms, CACHE_TTL_MS);
}

/**
 * The validator could not answer (429, 5xx, network): keep the last
 * validated status of this key, else fall back to oss.
 */
function unavailable(
	licenseKeyHash: string,
	now: number,
	reason: string,
	retryAfter: number | undefined,
): LicenseStatus {
	const ttlMs = retryAfter ?? FAILURE_TTL_MS;
	if (lastValidated?.licenseKeyHash === licenseKeyHash) {
		log.warn(
			"license validator unavailable — keeping the last validated mode",
			{
				reason,
			},
		);
		cached = { at: now, status: lastValidated, ttlMs };
		return lastValidated;
	}
	return fallback(licenseKeyHash, now, reason, ttlMs);
}

function fallback(
	licenseKeyHash: string,
	now: number,
	reason: string,
	ttlMs: number = FAILURE_TTL_MS,
): LicenseStatus {
	log.warn("license check failed — falling back to oss mode", { reason });
	if (lastValidated?.licenseKeyHash === licenseKeyHash) lastValidated = null;
	const status: LicenseStatus = {
		mode: "oss",
		valid: false,
		checkedAt: new Date(now).toISOString(),
		licenseKeyHash,
		reason,
	};
	cached = { at: now, status, ttlMs };
	return status;
}

/**
 * Cheap synchronous accessor — returns the *currently cached* mode
 * without ever touching the network. Use for response headers and other
 * hot paths; call `checkLicense()` once at boot to populate the cache.
 */
export function getLicenseMode(): LicenseMode {
	return cached?.status.mode ?? "oss";
}

/** For tests. */
export function __resetLicenseCache(): void {
	cached = null;
	lastValidated = null;
}
