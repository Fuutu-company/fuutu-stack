import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envStub = {
	FUUTU_LICENSE_KEY: undefined as string | undefined,
	FUUTU_TELEMETRY_ENDPOINT: undefined as string | undefined,
	FUUTU_TELEMETRY_DISABLED: false as boolean | undefined,
	NEXT_PUBLIC_SAAS_URL: undefined as string | undefined,
	NODE_ENV: "production" as "development" | "production" | "test",
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
	envStub.NODE_ENV = "production";
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
	envStub.FUUTU_LICENSE_KEY = undefined;
	envStub.FUUTU_TELEMETRY_ENDPOINT = undefined;
	envStub.FUUTU_TELEMETRY_DISABLED = false;
	envStub.NEXT_PUBLIC_SAAS_URL = undefined;
	envStub.NODE_ENV = "production";
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

	it("contains exactly the license-compliance fields", () => {
		const payload = buildTelemetryPayload();
		expect(Object.keys(payload).sort()).toEqual([
			"appUrl",
			"kind",
			"kitName",
			"kitVersion",
			"licenseKeyHash",
			"surface",
		]);
	});

	it("marks the ping as a runtime ping", () => {
		expect(buildTelemetryPayload().kind).toBe("runtime");
	});

	it("reports runtime pings as the web surface (desktop installs never ping)", () => {
		expect(buildTelemetryPayload().surface).toBe("web");
	});

	it("appUrl is the public app URL, or null", () => {
		expect(buildTelemetryPayload().appUrl).toBeNull();
		envStub.NEXT_PUBLIC_SAAS_URL = "https://app.example.com";
		expect(buildTelemetryPayload().appUrl).toBe("https://app.example.com");
	});

	it("sends no runtime, platform, feature or timestamp data", () => {
		const payload: Record<string, unknown> = buildTelemetryPayload();
		for (const key of ["nodeVersion", "platform", "features", "sentAt"]) {
			expect(payload, key).not.toHaveProperty(key);
		}
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

	it.each(["development", "test"] as const)(
		"skips the runtime ping outside production (NODE_ENV=%s)",
		async (nodeEnv) => {
			envStub.NODE_ENV = nodeEnv;
			const mockFetch = vi.fn();
			globalThis.fetch = mockFetch;
			const result = await pingTelemetry("https://test.example.com/ping");
			expect(result).toEqual({ sent: false, reason: "not-production" });
			expect(mockFetch).not.toHaveBeenCalled();
		},
	);

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
		const options = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
		expect(options?.method).toBe("POST");
		expect(options?.body).toBeDefined();
		const body = JSON.parse(options?.body as string);
		expect(body.kitName).toBeDefined();
		expect(body.kitVersion).toBeDefined();
	});

	it("never follows redirects and aborts via a timeout signal", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		globalThis.fetch = mockFetch;
		await pingTelemetry("https://test.example.com/ping");
		const options = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
		expect(options?.redirect).toBe("error");
		expect(options?.signal).toBeInstanceOf(AbortSignal);
	});

	it("includes X-Framework header in the request", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		globalThis.fetch = mockFetch;
		await pingTelemetry("https://test.example.com/ping");
		const options = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
		const headers = options?.headers as Record<string, string>;
		expect(headers["X-Framework"]).toBeDefined();
	});

	it("verifies no real network calls are made (fetch is mocked)", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValue(new Response("ok", { status: 200 }));
		globalThis.fetch = mockFetch;
		await pingTelemetry("https://test.example.com/ping");
		expect(mockFetch).toHaveBeenCalled();
		const url = mockFetch.mock.calls[0]?.[0];
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
