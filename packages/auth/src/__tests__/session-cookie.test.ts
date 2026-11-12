import { describe, expect, it } from "vitest";
import { hasApiKeyCredential, hasSessionCookie } from "../session-cookie";

const withCookie = (cookie?: string) => new Headers(cookie ? { cookie } : {});

describe("hasSessionCookie", () => {
	it("detects the plain cookie (http, local dev)", () => {
		expect(
			hasSessionCookie(withCookie("better-auth.session_token=abc.def")),
		).toBe(true);
	});

	it("detects the __Secure- cookie Better Auth sets over https (production)", () => {
		expect(
			hasSessionCookie(
				withCookie("__Secure-better-auth.session_token=abc.def; theme=dark"),
			),
		).toBe(true);
	});

	it("is false without a session cookie", () => {
		expect(hasSessionCookie(withCookie())).toBe(false);
		expect(hasSessionCookie(withCookie("theme=dark"))).toBe(false);
	});
});

describe("hasApiKeyCredential", () => {
	const h = (init: Record<string, string>) => new Headers(init);

	it("accepts the x-api-key header", () => {
		expect(hasApiKeyCredential(h({ "x-api-key": "futu_sk_abc" }))).toBe(true);
	});

	it("accepts a Bearer token with the kit's API-key prefix", () => {
		expect(
			hasApiKeyCredential(h({ authorization: "Bearer futu_sk_abc" })),
		).toBe(true);
	});

	it("ignores other bearer tokens (OAuth JWTs, session tokens)", () => {
		expect(hasApiKeyCredential(h({ authorization: "Bearer eyJhbGci" }))).toBe(
			false,
		);
		expect(hasApiKeyCredential(h({}))).toBe(false);
	});
});
