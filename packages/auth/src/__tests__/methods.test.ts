import { describe, expect, it, vi } from "vitest";
import {
	isSocialProviderActive,
	type MethodsConfig,
	resolveAuthMethods,
} from "../methods";

vi.mock("@fuutu/env/saas", () => ({ env: {} }));

const allOn: MethodsConfig = {
	features: {
		emailPassword: true,
		magicLink: true,
		passkeys: true,
		socialLogin: true,
	},
	socialProviders: {
		google: { enabled: true },
		github: { enabled: true },
	},
};

const creds = {
	google: { clientId: "g-id", clientSecret: "g-secret" },
	github: { clientId: "gh-id", clientSecret: "gh-secret" },
};

describe("resolveAuthMethods()", () => {
	it("enables every method when all flags are on and credentials exist", () => {
		expect(resolveAuthMethods(creds, allOn)).toEqual({
			emailPassword: true,
			magicLink: true,
			passkey: true,
			google: true,
			github: true,
		});
	});

	it("disables email/password, magic link and passkey via their feature flags", () => {
		const methods = resolveAuthMethods(creds, {
			...allOn,
			features: {
				...allOn.features,
				emailPassword: false,
				magicLink: false,
				passkeys: false,
			},
		});
		expect(methods.emailPassword).toBe(false);
		expect(methods.magicLink).toBe(false);
		expect(methods.passkey).toBe(false);
		expect(methods.google).toBe(true);
	});

	it("hides every social provider when socialLogin is off", () => {
		const methods = resolveAuthMethods(creds, {
			...allOn,
			features: { ...allOn.features, socialLogin: false },
		});
		expect(methods.google).toBe(false);
		expect(methods.github).toBe(false);
	});

	it("hides a single provider disabled in socialProviders", () => {
		const methods = resolveAuthMethods(creds, {
			...allOn,
			socialProviders: { ...allOn.socialProviders, github: { enabled: false } },
		});
		expect(methods.google).toBe(true);
		expect(methods.github).toBe(false);
	});

	it("hides a provider whose client id or secret is missing or empty", () => {
		const methods = resolveAuthMethods(
			{
				google: { clientId: "g-id", clientSecret: "" },
				github: { clientId: undefined, clientSecret: "gh-secret" },
			},
			allOn,
		);
		expect(methods.google).toBe(false);
		expect(methods.github).toBe(false);
	});

	it("returns only booleans (no credential leaks to the client)", () => {
		const methods = resolveAuthMethods(creds, allOn);
		for (const value of Object.values(methods)) {
			expect(typeof value).toBe("boolean");
		}
	});
});

describe("isSocialProviderActive()", () => {
	it("is true only with flag + provider enabled + id + secret", () => {
		expect(isSocialProviderActive("google", creds.google, allOn)).toBe(true);
		expect(
			isSocialProviderActive(
				"google",
				{ clientId: "g-id", clientSecret: undefined },
				allOn,
			),
		).toBe(false);
	});
});
