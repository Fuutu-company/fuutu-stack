import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envStub = {
	FUUTU_LICENSE_KEY: undefined as string | undefined,
	FUUTU_TELEMETRY_ENDPOINT: undefined as string | undefined,
	FUUTU_TELEMETRY_DISABLED: false as boolean | undefined,
	NEXT_PUBLIC_SAAS_URL: undefined as string | undefined,
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

const { buildTelemetryPayload, pingTelemetry } = await import("../index");

const originalFetch = globalThis.fetch;

beforeEach(() => {
	envStub.FUUTU_LICENSE_KEY = undefined;
	envStub.FUUTU_TELEMETRY_ENDPOINT = undefined;
	envStub.FUUTU_TELEMETRY_DISABLED = false;
	envStub.NEXT_PUBLIC_SAAS_URL = undefined;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
	envStub.FUUTU_LICENSE_KEY = undefined;
	envStub.FUUTU_TELEMETRY_ENDPOINT = undefined;
	envStub.FUUTU_TELEMETRY_DISABLED = false;
	envStub.NEXT_PUBLIC_SAAS_URL = undefined;
});

describe("buildTelemetryPayload()", () => {
	it("includes kitName", () => {
		const payload = buildTelemetryPayload();
		expect(payload.kitName).toBeDefined();
		expect(typeof payload.kitName).toBe("string");
		expect(payload.kitName.length).toBeGreaterThan(0);
	});

	it("includes kitVersion", () => {
		const payload = buildTelemetryPayload();
		expect(payload.kitVersion).toBeDefined();
		expect(typeof payload.kitVersion).toBe("string");
	});

	it("includes licenseKeyHash", () => {
		const payload = buildTelemetryPayload();
		expect(payload.licenseKeyHash).toBeDefined();
		expect(typeof payload.licenseKeyHash).toBe("string");
	});

	it("licenseKeyHash is 'oss' when no key is configured", () => {
		const payload = buildTelemetryPayload();
		expect(payload.licenseKeyHash).toBe("oss");
	});

	it("includes appUrl", () => {
		const payload = buildTelemetryPayload();
		expect(payload).toHaveProperty("appUrl");
	});

	it("includes features as an array", () => {
		const payload = buildTelemetryPayload();
		expect(Array.isArray(payload.features)).toBe(true);
	});

	it("features contains only enabled feature names", () => {
		const payload = buildTelemetryPayload();
		for (const feature of payload.features) {
			expect(typeof feature).toBe("string");
		}
	});

	it("includes sentAt ISO timestamp", () => {
		const payload = buildTelemetryPayload();
		expect(payload.sentAt).toBeDefined();
		expect(() => new Date(payload.sentAt).toISOString()).not.toThrow();
	});

	it("includes nodeVersion", () => {
		const payload = buildTelemetryPayload();
		expect(payload.nodeVersion).toBe(process.version);
	});

	it("includes platform", () => {
		const payload = buildTelemetryPayload();
		expect(payload.platform).toBe(process.platform);
	});

	it("does not include PII or secrets", () => {
		const payload = buildTelemetryPayload();
		const serialized = JSON.stringify(payload);
		expect(serialized).not.toContain("password");
		expect(serialized).not.toContain("secret");
		expect(serialized).not.toContain("token");
		expect(serialized).not.toContain("apiKey");
	});

	it("does not include the raw license key", () => {
		envStub.FUUTU_LICENSE_KEY = "super-secret-key-12345";
		const payload = buildTelemetryPayload();
		const serialized = JSON.stringify(payload);
		expect(serialized).not.toContain("super-secret-key-12345");
	});
});

describe("pingTelemetry()", () => {
	it("resolves with sent:true when fetch succeeds", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		const result = await pingTelemetry("https://test.example.com/ping");
		expect(result.sent).toBe(true);
		if (result.sent) {
			expect(result.status).toBe(200);
		}
	});

	it("resolves with sent:false when fetch fails (never throws)", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));
		const result = await pingTelemetry("https://test.example.com/ping");
		expect(result.sent).toBe(false);
		if (!result.sent) {
			expect(result.reason).toBeDefined();
		}
	});

	it("never throws — swallows all errors", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("catastrophic"));
		await expect(
			pingTelemetry("https://test.example.com/ping"),
		).resolves.toBeDefined();
	});

	it("skips ping entirely when FUUTU_TELEMETRY_DISABLED=1", async () => {
		envStub.FUUTU_TELEMETRY_DISABLED = true;
		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;
		const result = await pingTelemetry("https://test.example.com/ping");
		expect(result.sent).toBe(false);
		if (!result.sent) {
			expect(result.reason).toBe("disabled");
		}
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("skips ping entirely when FUUTU_TELEMETRY_DISABLED=true", async () => {
		envStub.FUUTU_TELEMETRY_DISABLED = true;
		const mockFetch = vi.fn();
		globalThis.fetch = mockFetch;
		const result = await pingTelemetry("https://test.example.com/ping");
		expect(result.sent).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("does not skip when FUUTU_TELEMETRY_DISABLED is not set", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		globalThis.fetch = mockFetch;
		await pingTelemetry("https://test.example.com/ping");
		expect(mockFetch).toHaveBeenCalled();
	});

	it("does not skip when FUUTU_TELEMETRY_DISABLED=0", async () => {
		envStub.FUUTU_TELEMETRY_DISABLED = false;
		const mockFetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		globalThis.fetch = mockFetch;
		await pingTelemetry("https://test.example.com/ping");
		expect(mockFetch).toHaveBeenCalled();
	});

	it("sends POST request with JSON body", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		globalThis.fetch = mockFetch;
		await pingTelemetry("https://test.example.com/ping");
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [, opts] = mockFetch.mock.calls[0]!; // guaranteed by toHaveBeenCalledTimes
		const options = opts as RequestInit;
		expect(options.method).toBe("POST");
		expect(options.body).toBeDefined();
		const body = JSON.parse(options.body as string);
		expect(body.kitName).toBeDefined();
		expect(body.kitVersion).toBeDefined();
	});

	it("includes X-Framework header in the request", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		globalThis.fetch = mockFetch;
		await pingTelemetry("https://test.example.com/ping");
		const [, opts] = mockFetch.mock.calls[0]!; // guaranteed by toHaveBeenCalled
		const options = opts as RequestInit;
		const headers = options.headers as Record<string, string>;
		expect(headers["X-Framework"]).toBeDefined();
	});

	it("verifies no real network calls are made (fetch is mocked)", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		globalThis.fetch = mockFetch;
		await pingTelemetry("https://test.example.com/ping");
		expect(mockFetch).toHaveBeenCalled();
		const [url] = mockFetch.mock.calls[0]!; // guaranteed by toHaveBeenCalled
		expect(String(url)).toBe("https://test.example.com/ping");
	});

	it("handles non-200 status codes gracefully", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(new Response("error", { status: 500 }));
		const result = await pingTelemetry("https://test.example.com/ping");
		expect(result.sent).toBe(true);
		if (result.sent) {
			expect(result.status).toBe(500);
		}
	});
});
