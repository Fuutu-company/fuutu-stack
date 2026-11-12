import { createMemoryRateLimitStore } from "@fuutu/utils/rate-limit";
import { describe, expect, it, vi } from "vitest";
import { getClientIp } from "../client-ip";
import { checkMcpRateLimit, mcpRateLimitBucket } from "../mcp/rate-limit";

vi.mock("../config", () => ({
	apiConfig: { rateLimit: { trustProxyHeaders: true } },
}));

const user = {
	kind: "user" as const,
	via: "api-key" as const,
	credentialId: "key-1",
	userId: "user-1",
	organizationId: "org-1",
	orgRole: "owner",
	systemRole: null,
	scopes: ["mcp"],
};
const anonymous = { kind: "anonymous" as const };
const limits = {
	anonymous: { maxRequests: 2, windowMs: 60_000 },
	authenticated: { maxRequests: 5, windowMs: 60_000 },
};
const fromIp = (xff: string) => new Headers({ "x-forwarded-for": xff });

describe("getClientIp", () => {
	it("ignores forwarding headers unless a trusted proxy is configured", () => {
		expect(getClientIp(fromIp("1.1.1.1"), false)).toBeNull();
	});

	it("takes the right-most X-Forwarded-For entry (the one the proxy appended)", () => {
		expect(getClientIp(fromIp("6.6.6.6, 2.2.2.2"), true)).toBe("2.2.2.2");
	});

	it("falls back to X-Real-IP, then null", () => {
		expect(getClientIp(new Headers({ "x-real-ip": " 3.3.3.3 " }), true)).toBe(
			"3.3.3.3",
		);
		expect(getClientIp(new Headers(), true)).toBeNull();
	});
});

describe("mcpRateLimitBucket", () => {
	it("keys signed-in callers on their credential, not their IP", () => {
		expect(mcpRateLimitBucket(user, fromIp("1.1.1.1"))).toBe("mcp:key:key-1");
	});

	it("keys anonymous callers on their IP", () => {
		expect(mcpRateLimitBucket(anonymous, fromIp("1.1.1.1"))).toBe(
			"mcp:ip:1.1.1.1",
		);
		expect(mcpRateLimitBucket(anonymous, new Headers())).toBe("mcp:anonymous");
	});
});

describe("checkMcpRateLimit", () => {
	it("limits each anonymous IP separately — one caller can't exhaust everyone", async () => {
		const store = createMemoryRateLimitStore();
		const a = fromIp("1.1.1.1");
		await checkMcpRateLimit(anonymous, a, limits, store);
		await checkMcpRateLimit(anonymous, a, limits, store);
		const denied = await checkMcpRateLimit(anonymous, a, limits, store);
		expect(denied?.status).toBe(429);
		expect(denied?.headers.get("retry-after")).toBe("60");
		expect(
			await checkMcpRateLimit(anonymous, fromIp("2.2.2.2"), limits, store),
		).toBeNull();
	});

	it("gives credentials the higher authenticated budget", async () => {
		const store = createMemoryRateLimitStore();
		for (let i = 0; i < 5; i++) {
			expect(
				await checkMcpRateLimit(user, fromIp("1.1.1.1"), limits, store),
			).toBeNull();
		}
		expect(
			(await checkMcpRateLimit(user, fromIp("1.1.1.1"), limits, store))?.status,
		).toBe(429);
	});
});
