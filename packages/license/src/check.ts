import { KIT_NAME, KIT_VERSION } from "@fuutu/config";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { hashLicenseKey } from "./hash";
import type { CheckLicenseOptions, LicenseMode, LicenseStatus } from "./types";

const log = createLogger({ scope: "license" });

const DEFAULT_ENDPOINT = "https://stackapp.fuutu.com/api/license/validate";
const DEFAULT_TIMEOUT_MS = 5_000;
/** In-memory cache TTL — long enough that hot paths don't re-hit the
 *  validator, short enough that a freshly-purchased key starts working
 *  on the next process restart. */
const CACHE_TTL_MS = 60 * 60 * 1_000;

let cached: { at: number; status: LicenseStatus } | null = null;

/**
 * Validate the configured Fuutu license key against the Fuutu license
 * endpoint.
 *
 * **Placeholder behaviour (v1):** the validation endpoint is not yet
 * publicly hosted by Fuutu. This function is therefore designed to fail
 * **soft** — any network error, 4xx, 5xx, malformed payload or missing
 * configuration falls back to `mode: "oss"` and never throws. The kit
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
 */
export async function checkLicense(
	options: CheckLicenseOptions = {},
): Promise<LicenseStatus> {
	const now = Date.now();
	if (!options.force && cached && now - cached.at < CACHE_TTL_MS) {
		return cached.status;
	}

	const licenseKey = options.licenseKey ?? env.FUUTU_LICENSE_KEY ?? "";
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
		cached = { at: now, status };
		return status;
	}

	const endpoint =
		options.endpoint ?? env.FUUTU_LICENSE_ENDPOINT ?? DEFAULT_ENDPOINT;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: licenseKey,
				kitName: KIT_NAME,
				kitVersion: KIT_VERSION,
			}),
			signal: controller.signal,
		}).finally(() => clearTimeout(timer));

		if (!res.ok) {
			return fallback(licenseKeyHash, now, `HTTP ${res.status}`);
		}

		const body = (await res.json().catch(() => null)) as {
			mode?: LicenseMode;
			valid?: boolean;
			reason?: string;
		} | null;

		if (!body || body.valid !== true || !body.mode) {
			return fallback(licenseKeyHash, now, body?.reason ?? "invalid response");
		}

		const status: LicenseStatus = {
			mode: body.mode,
			valid: true,
			checkedAt: new Date(now).toISOString(),
			licenseKeyHash,
		};
		cached = { at: now, status };
		return status;
	} catch (err) {
		const reason = err instanceof Error ? err.message : "network error";
		return fallback(licenseKeyHash, now, reason);
	}
}

function fallback(
	licenseKeyHash: string,
	now: number,
	reason: string,
): LicenseStatus {
	log.warn("license check failed — falling back to oss mode", { reason });
	const status: LicenseStatus = {
		mode: "oss",
		valid: false,
		checkedAt: new Date(now).toISOString(),
		licenseKeyHash,
		reason,
	};
	cached = { at: now, status };
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
}
