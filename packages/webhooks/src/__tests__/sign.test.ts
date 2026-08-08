import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	signPayload,
	signPayloadWithTimestamp,
	verifyPayloadWithTimestamp,
} from "../sign";

describe("signPayload", () => {
	it("produces the correct HMAC-SHA256 hex signature for known input", () => {
		const secret = "test-secret";
		const payload = { hello: "world" };
		const expected = createHmac("sha256", secret)
			.update(JSON.stringify(payload))
			.digest("hex");

		expect(signPayload(secret, payload)).toBe(expected);
	});

	it("produces different signatures for different secrets", () => {
		const payload = { event: "test" };
		const sig1 = signPayload("secret-1", payload);
		const sig2 = signPayload("secret-2", payload);

		expect(sig1).not.toBe(sig2);
	});

	it("produces different signatures for different payloads", () => {
		const secret = "shared-secret";
		const sig1 = signPayload(secret, { a: 1 });
		const sig2 = signPayload(secret, { a: 2 });

		expect(sig1).not.toBe(sig2);
	});

	it("accepts string payloads directly", () => {
		const secret = "test-secret";
		const body = '{"hello":"world"}';
		const expected = createHmac("sha256", secret).update(body).digest("hex");

		expect(signPayload(secret, body)).toBe(expected);
	});

	it("returns a hex string", () => {
		const sig = signPayload("s", { x: 1 });
		expect(sig).toMatch(/^[0-9a-f]+$/);
	});
});

describe("signPayloadWithTimestamp", () => {
	it("produces the correct t=...,v1=... format", () => {
		const sig = signPayloadWithTimestamp("secret", { a: 1 }, 1700000000);
		expect(sig).toMatch(/^t=1700000000,v1=[0-9a-f]+$/);
	});

	it("embeds the timestamp in the t= prefix", () => {
		const ts = 1700000000;
		const sig = signPayloadWithTimestamp("secret", { a: 1 }, ts);
		expect(sig.startsWith(`t=${ts},`)).toBe(true);
	});

	it("computes the HMAC over signedPayload = <timestamp>.<body>", () => {
		const secret = "test-secret";
		const payload = { hello: "world" };
		const timestamp = 1700000000;
		const body = JSON.stringify(payload);
		const signedPayload = `${timestamp}.${body}`;
		const expectedHmac = createHmac("sha256", secret)
			.update(signedPayload)
			.digest("hex");

		const sig = signPayloadWithTimestamp(secret, payload, timestamp);
		expect(sig).toBe(`t=${timestamp},v1=${expectedHmac}`);
	});

	it("produces different signatures for different timestamps", () => {
		const secret = "shared-secret";
		const payload = { event: "test" };
		const sig1 = signPayloadWithTimestamp(secret, payload, 1700000000);
		const sig2 = signPayloadWithTimestamp(secret, payload, 1700000001);

		expect(sig1).not.toBe(sig2);
	});

	it("produces different signatures for different payloads at same timestamp", () => {
		const secret = "shared-secret";
		const ts = 1700000000;
		const sig1 = signPayloadWithTimestamp(secret, { a: 1 }, ts);
		const sig2 = signPayloadWithTimestamp(secret, { a: 2 }, ts);

		expect(sig1).not.toBe(sig2);
	});

	it("accepts string payloads directly", () => {
		const secret = "test-secret";
		const body = '{"hello":"world"}';
		const timestamp = 1700000000;
		const signedPayload = `${timestamp}.${body}`;
		const expectedHmac = createHmac("sha256", secret)
			.update(signedPayload)
			.digest("hex");

		const sig = signPayloadWithTimestamp(secret, body, timestamp);
		expect(sig).toBe(`t=${timestamp},v1=${expectedHmac}`);
	});
});

describe("verifyPayloadWithTimestamp", () => {
	const secret = "test-secret";
	const payload = { hello: "world" };
	const body = JSON.stringify(payload);
	const timestamp = Math.floor(Date.now() / 1000);

	it("verifies a valid signature", () => {
		const sig = signPayloadWithTimestamp(secret, payload, timestamp);
		expect(verifyPayloadWithTimestamp(secret, body, sig)).toBe(true);
	});

	it("rejects a wrong secret", () => {
		const sig = signPayloadWithTimestamp(secret, payload, timestamp);
		expect(verifyPayloadWithTimestamp("wrong-secret", body, sig)).toBe(false);
	});

	it("rejects a tampered body", () => {
		const sig = signPayloadWithTimestamp(secret, payload, timestamp);
		expect(verifyPayloadWithTimestamp(secret, '{"hello":"mars"}', sig)).toBe(
			false,
		);
	});

	it("rejects a malformed signature header", () => {
		expect(verifyPayloadWithTimestamp(secret, body, "garbage")).toBe(false);
		expect(verifyPayloadWithTimestamp(secret, body, "t=123,v1=nothex")).toBe(
			false,
		);
	});

	it("rejects an expired timestamp (outside default 300s window)", () => {
		const oldTs = timestamp - 600;
		const sig = signPayloadWithTimestamp(secret, payload, oldTs);
		expect(verifyPayloadWithTimestamp(secret, body, sig)).toBe(false);
	});

	it("accepts an expired timestamp when maxAgeSec is increased", () => {
		const oldTs = timestamp - 600;
		const sig = signPayloadWithTimestamp(secret, payload, oldTs);
		expect(verifyPayloadWithTimestamp(secret, body, sig, 3600)).toBe(true);
	});

	it("rejects a future timestamp outside the window", () => {
		const futureTs = timestamp + 600;
		const sig = signPayloadWithTimestamp(secret, payload, futureTs);
		expect(verifyPayloadWithTimestamp(secret, body, sig)).toBe(false);
	});
});
