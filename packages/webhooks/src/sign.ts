import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sign a webhook payload with HMAC-SHA256.
 * Returns the hex-encoded signature.
 */
export function signPayload(secret: string, payload: unknown): string {
	const body = typeof payload === "string" ? payload : JSON.stringify(payload);
	return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Sign a webhook payload with a timestamp for replay protection.
 * Returns a Stripe/GitHub-style signature: `t=<timestamp>,v1=<hmac>`.
 *
 * The signed payload is `<timestamp>.<body>` — verifiers must reconstruct
 * this exact string to check the HMAC.
 */
export function signPayloadWithTimestamp(
	secret: string,
	payload: unknown,
	timestamp: number,
): string {
	const body = typeof payload === "string" ? payload : JSON.stringify(payload);
	const signedPayload = `${timestamp}.${body}`;
	const hmac = createHmac("sha256", secret).update(signedPayload).digest("hex");
	return `t=${timestamp},v1=${hmac}`;
}

/**
 * Verify a `t=<timestamp>,v1=<hmac>` signature header against a payload.
 *
 * Reconstructs `signedPayload = ${timestamp}.${body}`, recomputes the HMAC,
 * and compares it in constant time. Rejects if the header is malformed, the
 * HMAC does not match, or the timestamp is older than `maxAgeSec` (default
 * 300s) to prevent replay attacks.
 *
 * @returns `true` if the signature is valid and within the time window.
 */
export function verifyPayloadWithTimestamp(
	secret: string,
	body: string,
	signatureHeader: string,
	maxAgeSec = 300,
): boolean {
	const parts = signatureHeader.split(",");
	const tsPart = parts.find((p) => p.startsWith("t="));
	const v1Part = parts.find((p) => p.startsWith("v1="));
	if (!tsPart || !v1Part) return false;

	const timestamp = Number(tsPart.slice(2));
	const providedHmac = v1Part.slice(3);
	if (!Number.isFinite(timestamp) || !providedHmac) return false;

	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - timestamp) > maxAgeSec) return false;

	const signedPayload = `${timestamp}.${body}`;
	const expectedHmac = createHmac("sha256", secret)
		.update(signedPayload)
		.digest("hex");

	const provided = Buffer.from(providedHmac, "hex");
	const expected = Buffer.from(expectedHmac, "hex");
	if (provided.length !== expected.length) return false;
	return timingSafeEqual(provided, expected);
}
