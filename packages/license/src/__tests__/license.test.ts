import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envStub = {
	FUUTU_LICENSE_KEY: undefined as string | undefined,
	FUUTU_LICENSE_ENDPOINT: undefined as string | undefined,
};

vi.mock("@fuutu/env/saas", () => ({
	env: new Proxy(
		{},
		{
			get(_t, prop: string) {
				return envStub[prop as keyof typeof envStub];
			},
		},
	),
}));

const { __resetLicenseCache, checkLicense, getLicenseMode, hashLicenseKey } =
	await import("../index");

const originalFetch = globalThis.fetch;

beforeEach(() => {
	__resetLicenseCache();
	envStub.FUUTU_LICENSE_KEY = undefined;
	envStub.FUUTU_LICENSE_ENDPOINT = undefined;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
	envStub.FUUTU_LICENSE_KEY = undefined;
	envStub.FUUTU_LICENSE_ENDPOINT = undefined;
});

describe("hashLicenseKey()", () => {
	it("returns 'oss' for empty string", () => {
		expect(hashLicenseKey("")).toBe("oss");
	});

	it("returns 'oss' for undefined", () => {
		expect(hashLicenseKey(undefined)).toBe("oss");
	});

	it("returns 'oss' for null", () => {
		expect(hashLicenseKey(null)).toBe("oss");
	});

	it("returns 'oss' for whitespace-only string", () => {
		expect(hashLicenseKey("   ")).toBe("oss");
	});

	it("returns a 32-char hex string for a non-empty key", () => {
		const result = hashLicenseKey("test-key-123");
		expect(result).toMatch(/^[0-9a-f]{32}$/);
	});

	it("is deterministic — same input produces same output", () => {
		expect(hashLicenseKey("PRO-1234")).toBe(hashLicenseKey("PRO-1234"));
	});

	it("different inputs produce different hashes", () => {
		expect(hashLicenseKey("key-one")).not.toBe(hashLicenseKey("key-two"));
	});

	it("trims whitespace before hashing", () => {
		expect(hashLicenseKey("  test-key  ")).toBe(hashLicenseKey("test-key"));
	});

	it("never returns the raw key", () => {
		const key = "super-secret-license-key";
		const result = hashLicenseKey(key);
		expect(result).not.toContain(key);
	});
});

describe("getLicenseMode()", () => {
	it("defaults to 'oss' when not checked yet", () => {
		__resetLicenseCache();
		expect(getLicenseMode()).toBe("oss");
	});

	it("returns cached mode after checkLicense resolves", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ mode: "mcp", valid: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		await checkLicense({ licenseKey: "valid-key", force: true });
		expect(getLicenseMode()).toBe("mcp");
	});

	it("returns 'oss' after a failed check", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));
		await checkLicense({ licenseKey: "some-key", force: true });
		expect(getLicenseMode()).toBe("oss");
	});
});

describe("checkLicense()", () => {
	it("returns oss mode when no license key is configured", async () => {
		const status = await checkLicense({ force: true });
		expect(status.mode).toBe("oss");
		expect(status.valid).toBe(true);
		expect(status.licenseKeyHash).toBe("oss");
	});

	it("does not call fetch when no license key is configured", async () => {
		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;
		await checkLicense({ force: true });
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("returns pro/mcp mode when fetch returns valid license", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ mode: "mcp", valid: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const status = await checkLicense({
			licenseKey: "valid-pro-key",
			force: true,
		});
		expect(status.mode).toBe("mcp");
		expect(status.valid).toBe(true);
	});

	it("returns enterprise mode when fetch returns enterprise license", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ mode: "enterprise", valid: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const status = await checkLicense({
			licenseKey: "valid-enterprise-key",
			force: true,
		});
		expect(status.mode).toBe("enterprise");
		expect(status.valid).toBe(true);
	});

	it("soft-falls back to oss when fetch fails (network error)", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));
		const status = await checkLicense({
			licenseKey: "some-key",
			force: true,
		});
		expect(status.mode).toBe("oss");
		expect(status.valid).toBe(false);
		expect(status.reason).toBeDefined();
	});

	it("soft-falls back to oss when fetch returns 401", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
		const status = await checkLicense({
			licenseKey: "invalid-key",
			force: true,
		});
		expect(status.mode).toBe("oss");
		expect(status.valid).toBe(false);
	});

	it("soft-falls back to oss when fetch returns 500", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(new Response("Server Error", { status: 500 }));
		const status = await checkLicense({
			licenseKey: "some-key",
			force: true,
		});
		expect(status.mode).toBe("oss");
		expect(status.valid).toBe(false);
	});

	it("soft-falls back to oss when response body is malformed", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response("not json", {
				status: 200,
				headers: { "Content-Type": "text/plain" },
			}),
		);
		const status = await checkLicense({
			licenseKey: "some-key",
			force: true,
		});
		expect(status.mode).toBe("oss");
		expect(status.valid).toBe(false);
	});

	it("soft-falls back to oss when valid is false in response", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ valid: false, reason: "expired" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const status = await checkLicense({
			licenseKey: "expired-key",
			force: true,
		});
		expect(status.mode).toBe("oss");
		expect(status.valid).toBe(false);
	});

	it("soft-falls back to oss on timeout (abort)", async () => {
		globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
			return new Promise((_resolve, reject) => {
				const signal = (opts as { signal?: AbortSignal }).signal;
				if (signal) {
					signal.addEventListener("abort", () => {
						reject(new Error("The operation was aborted"));
					});
				}
			});
		});
		const status = await checkLicense({
			licenseKey: "some-key",
			force: true,
			timeoutMs: 50,
		});
		expect(status.mode).toBe("oss");
		expect(status.valid).toBe(false);
	});

	it("never throws — all errors are caught", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("catastrophic"));
		await expect(
			checkLicense({ licenseKey: "some-key", force: true }),
		).resolves.toBeDefined();
	});

	it("includes licenseKeyHash in the status", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ mode: "oss", valid: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const status = await checkLicense({ licenseKey: "test-key", force: true });
		expect(status.licenseKeyHash).toBe(hashLicenseKey("test-key"));
	});

	it("includes checkedAt ISO timestamp in the status", async () => {
		const status = await checkLicense({ force: true });
		expect(status.checkedAt).toBeDefined();
		expect(() => new Date(status.checkedAt).toISOString()).not.toThrow();
	});

	it("uses cache on subsequent calls without force", async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ mode: "mcp", valid: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		globalThis.fetch = mockFetch;
		await checkLicense({ licenseKey: "valid-key", force: true });
		await checkLicense({ licenseKey: "valid-key" });
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("force=true bypasses cache", async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ mode: "mcp", valid: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		globalThis.fetch = mockFetch;
		await checkLicense({ licenseKey: "valid-key", force: true });
		await checkLicense({ licenseKey: "valid-key", force: true });
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it("verifies no real network calls are made (fetch is mocked)", async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ mode: "mcp", valid: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		globalThis.fetch = mockFetch;
		await checkLicense({
			licenseKey: "test",
			endpoint: "https://mocked.test/api/license",
			force: true,
		});
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url] = mockFetch.mock.calls[0]!; // guaranteed by toHaveBeenCalledTimes
		expect(String(url)).toBe("https://mocked.test/api/license");
	});
});
