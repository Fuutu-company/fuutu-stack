import { describe, expect, it } from "vitest";
import {
	hasApiKeyCredential,
	hasDesktopBearer,
	hasSessionCookie,
} from "../session-cookie";

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

	it("reads a project-specific cookie prefix (several projects on localhost)", () => {
		const headers = withCookie(
			"better-auth.session_token=other; better-auth-s1.session_token=mine",
		);
		expect(hasSessionCookie(headers, "better-auth-s1")).toBe(true);
		expect(
			hasSessionCookie(
				withCookie("better-auth.session_token=x"),
				"better-auth-s1",
			),
		).toBe(false);
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

describe("hasDesktopBearer", () => {
	const bearer = new Headers({ authorization: "Bearer eyJhbGciOi.x.y" });

	it("lets a bearer through to /api only while the desktop switch is on", () => {
		expect(hasDesktopBearer(bearer, "/api/desktop/session", true)).toBe(true);
		expect(hasDesktopBearer(bearer, "/api/rpc/x", true)).toBe(true);
		expect(hasDesktopBearer(bearer, "/api/desktop/session", false)).toBe(false);
	});

	it("never bypasses page routes or an empty bearer", () => {
		expect(hasDesktopBearer(bearer, "/dashboard", true)).toBe(false);
		expect(hasDesktopBearer(bearer, "/apix", true)).toBe(false);
		expect(
			hasDesktopBearer(
				new Headers({ authorization: "Bearer " }),
				"/api/x",
				true,
			),
		).toBe(false);
		expect(hasDesktopBearer(new Headers(), "/api/x", true)).toBe(false);
	});
});
