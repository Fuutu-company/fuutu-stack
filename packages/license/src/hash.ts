import { createHash } from "node:crypto";

/**
 * Stable one-way hash for the configured license key, suitable for
 * sending to the Fuutu telemetry endpoint without leaking the secret.
 *
 * - Empty / missing key → the literal string `"oss"`. Telemetry uses this
 *   as the OSS marker so we don't have to special-case the field shape.
 * - Otherwise → a hex SHA-256 truncated to 32 chars (128 bits, plenty of
 *   collision space for the size of the licensee universe).
 */
export function hashLicenseKey(key?: string | null): string {
	const trimmed = key?.trim();
	if (!trimmed) return "oss";
	return createHash("sha256").update(trimmed).digest("hex").slice(0, 32);
}
