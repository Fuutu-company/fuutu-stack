import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { assertPasswordPolicy } from "../hooks/password-policy";

// authConfig.passwordPolicy: min 8, upper, lower, number, special required.
const STRONG = "Str0ng!Pass";
const WEAK = "weak";

describe("assertPasswordPolicy()", () => {
	it("accepts a compliant password on /sign-up/email", () => {
		expect(() =>
			assertPasswordPolicy("/sign-up/email", { password: STRONG }),
		).not.toThrow();
	});

	it("rejects a weak password on /sign-up/email", () => {
		expect(() =>
			assertPasswordPolicy("/sign-up/email", { password: WEAK }),
		).toThrow(APIError);
	});

	it("rejects a password missing a special char on /sign-up/email", () => {
		expect(() =>
			assertPasswordPolicy("/sign-up/email", { password: "Str0ngPass" }),
		).toThrow(APIError);
	});

	it("validates newPassword on /change-password", () => {
		expect(() =>
			assertPasswordPolicy("/change-password", {
				currentPassword: STRONG,
				newPassword: WEAK,
			}),
		).toThrow(APIError);
		expect(() =>
			assertPasswordPolicy("/change-password", {
				currentPassword: WEAK,
				newPassword: STRONG,
			}),
		).not.toThrow();
	});

	it("validates newPassword on /reset-password", () => {
		expect(() =>
			assertPasswordPolicy("/reset-password", { newPassword: WEAK }),
		).toThrow(APIError);
		expect(() =>
			assertPasswordPolicy("/reset-password", { newPassword: STRONG }),
		).not.toThrow();
	});

	it("validates password on /admin/create-user", () => {
		expect(() =>
			assertPasswordPolicy("/admin/create-user", { password: WEAK }),
		).toThrow(APIError);
	});

	it("validates newPassword on /admin/set-user-password", () => {
		expect(() =>
			assertPasswordPolicy("/admin/set-user-password", { newPassword: WEAK }),
		).toThrow(APIError);
	});

	it("ignores non-password paths", () => {
		expect(() =>
			assertPasswordPolicy("/sign-in/email", { password: WEAK }),
		).not.toThrow();
	});

	it("skips bodies without a password field (schema validation reports those)", () => {
		expect(() => assertPasswordPolicy("/sign-up/email", {})).not.toThrow();
		expect(() =>
			assertPasswordPolicy("/sign-up/email", { password: 123 }),
		).not.toThrow();
		expect(() =>
			assertPasswordPolicy("/sign-up/email", undefined),
		).not.toThrow();
	});
});
