import {
	config,
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
	KIT_NAME,
	KIT_VERSION,
} from "@fuutu/config";
import { env } from "@fuutu/env/saas";
import { hashLicenseKey } from "@fuutu/license";

const DEFAULT_ENDPOINT = "https://stackapp.fuutu.com/api/telemetry/ping";
const DEFAULT_TIMEOUT_MS = 5_000;

export type TelemetryPayload = {
	kitName: string;
	kitVersion: string;
	licenseKeyHash: string;
	appUrl: string | null;
	nodeVersion: string;
	platform: string;
	features: string[];
	sentAt: string;
};

export type PingResult =
	| { sent: true; status: number }
	| { sent: false; reason: string };

/**
 * Build the telemetry payload.
 *
 * Hard rule: **no PII, no secrets, no user data, no env values**. Only
 * Kit-identity + a hashed license-key fingerprint + a flat list of
 * top-level feature names. The full schema is documented in LICENSE.md §7.
 */
export function buildTelemetryPayload(): TelemetryPayload {
	const features = Object.entries(config.features)
		.filter(([, enabled]) => enabled === true)
		.map(([name]) => name);

	return {
		kitName: KIT_NAME,
		kitVersion: KIT_VERSION,
		licenseKeyHash: hashLicenseKey(env.FUUTU_LICENSE_KEY),
		appUrl: env.NEXT_PUBLIC_SAAS_URL ?? null,
		nodeVersion: process.version,
		platform: process.platform,
		features,
		sentAt: new Date().toISOString(),
	};
}

/**
 * Build-time telemetry ping.
 *
 * Non-blocking, silent on failure, opt-out via `FUUTU_TELEMETRY_DISABLED`.
 *
 * **Placeholder behaviour (v1):** the telemetry endpoint is not yet
 * publicly hosted by Fuutu. The function attempts the POST anyway because
 * the contract — payload shape, timeout, opt-out switch — is what
 * downstream forks integrate against; once the receiving service is live
 * no client change is needed. All errors are swallowed so user builds are
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
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const res = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				[KIT_FINGERPRINT_HEADER_NAME]: KIT_FINGERPRINT_HEADER_VALUE,
			},
			body: JSON.stringify(payload),
			signal: controller.signal,
		}).finally(() => clearTimeout(timer));
		return { sent: true, status: res.status };
	} catch (err) {
		const reason = err instanceof Error ? err.message : "network error";
		return { sent: false, reason };
	}
}
