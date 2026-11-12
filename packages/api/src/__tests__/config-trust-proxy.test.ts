import { describe, expect, it, vi } from "vitest";

const { flag } = vi.hoisted(() => ({ flag: { value: undefined as unknown } }));

vi.mock("@fuutu/env/saas", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/env/saas")>();
	return {
		...actual,
		env: new Proxy(actual.env, {
			get(target, prop, receiver) {
				if (prop === "TRUST_PROXY_HEADERS") return flag.value;
				return Reflect.get(target, prop, receiver);
			},
		}),
	};
});

async function loadTrust(value: unknown): Promise<boolean> {
	flag.value = value;
	vi.resetModules();
	const { apiConfig } = await import("../config");
	return apiConfig.rateLimit.trustProxyHeaders;
}

describe("apiConfig.rateLimit.trustProxyHeaders", () => {
	it("follows TRUST_PROXY_HEADERS", async () => {
		expect(await loadTrust(true)).toBe(true);
		expect(await loadTrust(false)).toBe(false);
	});

	it("stays off for an unvalidated raw string (SKIP_ENV_VALIDATION)", async () => {
		expect(await loadTrust("0")).toBe(false);
	});
});
