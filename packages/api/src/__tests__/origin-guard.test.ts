import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "../origin-guard";

// Next.js standalone (Docker / Railpack / Coolify) builds request.url from
// HOSTNAME, not from the Host header — the app's own origin never matches
// it behind a proxy.
const STANDALONE_REQUEST_URL = "http://0.0.0.0:3000/api/auth/sign-in/email";

describe("isOriginAllowed", () => {
	const allowed = {
		requestUrl: STANDALONE_REQUEST_URL,
		appUrl: "https://app.example.com",
		corsOrigin: "https://example.com",
	};

	it("accepts the app's own origin when request.url is the internal standalone host", () => {
		expect(isOriginAllowed("https://app.example.com", allowed)).toBe(true);
	});

	it("accepts the configured CORS origin", () => {
		expect(isOriginAllowed("https://example.com", allowed)).toBe(true);
	});

	it("accepts the request URL host (same-origin without a proxy)", () => {
		expect(isOriginAllowed("http://0.0.0.0:3000", allowed)).toBe(true);
	});

	it("rejects a foreign origin", () => {
		expect(isOriginAllowed("https://evil.example.net", allowed)).toBe(false);
	});

	it("rejects a lookalike subdomain", () => {
		expect(isOriginAllowed("https://app.example.com.evil.net", allowed)).toBe(
			false,
		);
	});

	it("rejects a malformed origin", () => {
		expect(isOriginAllowed("not a url", allowed)).toBe(false);
	});

	it("ignores unset optional origins", () => {
		expect(
			isOriginAllowed("https://example.com", {
				requestUrl: STANDALONE_REQUEST_URL,
				appUrl: "https://app.example.com",
				corsOrigin: undefined,
			}),
		).toBe(false);
	});
});
