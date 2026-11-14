import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
	KIT_NAME,
	KIT_VERSION,
} from "@fuutu/config";
import { env } from "@fuutu/env/saas";
import { hashLicenseKey } from "@fuutu/license";

const DEFAULT_ENDPOINT = "https://app.fuutustack.com/api/telemetry/ping";
const DEFAULT_TIMEOUT_MS = 5_000;

/** Where a ping comes from: the build script or a running app. */
export type TelemetryKind = "build" | "runtime";

/**
 * The complete telemetry payload — license-compliance data only, exactly
 * the fields LICENSE.md §7 lists (a test keeps them in sync).
 */
export type TelemetryPayload = {
	kitName: string;
	kitVersion: string;
	/** One-way hash of `FUUTU_LICENSE_KEY`, or `"oss"` without a key. */
	licenseKeyHash: string;
	/** Public app URL (`NEXT_PUBLIC_SAAS_URL`), or null. */
	appUrl: string | null;
	kind: TelemetryKind;
};

export type PingResult =
	| { sent: true; status: number }
	| { sent: false; reason: string };

/**
 * Build the runtime telemetry payload.
 *
 * Hard rule: license-compliance data only — Kit identity, a hashed
 * license-key fingerprint and the public app URL. No end-user data, no
 * secrets, no other env values. Schema: LICENSE.md §7.
 */
export function buildTelemetryPayload(): TelemetryPayload {
	return {
		kitName: KIT_NAME,
		kitVersion: KIT_VERSION,
		licenseKeyHash: hashLicenseKey(env.FUUTU_LICENSE_KEY),
		appUrl: env.NEXT_PUBLIC_SAAS_URL || null,
		kind: "runtime",
	};
}

/**
 * Runtime telemetry ping.
 *
 * Non-blocking, silent on failure, opt-out via `FUUTU_TELEMETRY_DISABLED`.
 *
 * **Placeholder behaviour (v1):** the telemetry endpoint is not yet
 * publicly hosted by Fuutu. The function attempts the POST anyway because
 * the contract — payload shape, timeout, opt-out switch — is what
 * downstream forks integrate against; once the receiving service is live
 * no client change is needed. All errors are swallowed so callers are
 * never blocked or slowed.
 */
export async function pingTelemetry(
	endpoint: string = env.FUUTU_TELEMETRY_ENDPOINT ?? DEFAULT_ENDPOINT,
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<PingResult> {
	if (env.FUUTU_TELEMETRY_DISABLED) {
		return { sent: false, reason: "disabled" };
	}

	const payload = buildTelemetryPayload();

	try {
		// AbortSignal.timeout governs the full round-trip — a manual
		// AbortController cleared in .finally only covers until headers
		// arrive. Same pattern as checkLicense() in @fuutu/license.
		const res = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				[KIT_FINGERPRINT_HEADER_NAME]: KIT_FINGERPRINT_HEADER_VALUE,
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(timeoutMs),
			// Never follow redirects — a 307/308 would re-POST the payload
			// to the redirect target's host.
			redirect: "error",
		});
		return { sent: true, status: res.status };
	} catch (err) {
		const reason = err instanceof Error ? err.message : "network error";
		return { sent: false, reason };
	}
}
