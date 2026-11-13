import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { assertSignupPolicy } from "../hooks/signup-policy";

const open = { enabled: true, allowedDomains: [] as string[] };
const closed = { enabled: false, allowedDomains: [] as string[] };
const restricted = { enabled: true, allowedDomains: ["fuutustack.com"] };

describe("assertSignupPolicy()", () => {
	it("allows sign-up on /sign-up/email when enabled", () => {
		expect(() =>
			assertSignupPolicy(
				{ email: "a@b.dev" },
				{ path: "/sign-up/email" },
				open,
			),
		).not.toThrow();
	});

	it("rejects sign-up on /sign-up/email when disabled", () => {
		expect(() =>
			assertSignupPolicy(
				{ email: "a@b.dev" },
				{ path: "/sign-up/email" },
				closed,
			),
		).toThrow(APIError);
	});

	it("rejects magic-link auto sign-up when disabled", () => {
		expect(() =>
			assertSignupPolicy(
				{ email: "a@b.dev" },
				{ path: "/magic-link/verify" },
				closed,
			),
		).toThrow(APIError);
	});

	it("rejects social-callback sign-up when disabled", () => {
		expect(() =>
			assertSignupPolicy(
				{ email: "a@b.dev" },
				{ path: "/callback/google" },
				closed,
			),
		).toThrow(APIError);
	});

	it("does not block admin-provisioned users when disabled", () => {
		expect(() =>
			assertSignupPolicy(
				{ email: "a@b.dev" },
				{ path: "/admin/create-user" },
				closed,
			),
		).not.toThrow();
		expect(() =>
			assertSignupPolicy({ email: "a@b.dev" }, null, closed),
		).not.toThrow();
	});

	it("allows listed domains when allowedDomains is set", () => {
		expect(() =>
			assertSignupPolicy(
				{ email: "dev@fuutustack.com" },
				{ path: "/sign-up/email" },
				restricted,
			),
		).not.toThrow();
	});

	it("rejects unlisted domains when allowedDomains is set", () => {
		expect(() =>
			assertSignupPolicy(
				{ email: "dev@evil.dev" },
				{ path: "/sign-up/email" },
				restricted,
			),
		).toThrow(APIError);
	});

	it("rejects a missing email when allowedDomains is set", () => {
		expect(() =>
			assertSignupPolicy({}, { path: "/sign-up/email" }, restricted),
		).toThrow(APIError);
	});

	it("matches domains case-insensitively", () => {
		expect(() =>
			assertSignupPolicy(
				{ email: "dev@FUUTUSTACK.com" },
				{ path: "/sign-up/email" },
				restricted,
			),
		).not.toThrow();
	});
});
