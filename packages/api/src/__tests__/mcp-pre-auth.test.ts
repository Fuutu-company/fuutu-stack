import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An MCP request with a credential costs a DB lookup (API key) or a token
 * verification before the per-credential rate limit can run — so rejected
 * credentials (401) are counted per trusted client IP. Random-token floods
 * get 429 and stop reaching the lookup; valid credentials never consume
 * the budget. Without a trusted client IP nothing is throttled here.
 */

const resolvePrincipal = vi.hoisted(() => vi.fn());

const config = vi.hoisted(() => ({
	apiConfig: {
		rateLimit: {
			enabled: true,
			trustProxyHeaders: true,
			preAuth: { maxRequests: 2, windowMs: 60_000 },
		},
		mcp: {
			auth: "optional" as const,
			rateLimit: {
				anonymous: { maxRequests: 100, windowMs: 60_000 },
				authenticated: { maxRequests: 100, windowMs: 60_000 },
				preAuth: { maxRequests: 3, windowMs: 60_000 },
			},
		},
	},
}));

vi.mock("../config", () => config);

vi.mock("../mcp/server", () => ({
	mcpServer: {
		name: "test",
		version: "0.0.0",
		instructions: undefined,
		challenge: 'Bearer realm="mcp"',
		tools: [],
		prompts: [],
		resolvePrincipal,
		wrapTool: undefined,
	},
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

// A fresh store per test instead of the process-wide singleton.
const store = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@fuutu/utils/rate-limit", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@fuutu/utils/rate-limit")>();
	return {
		...actual,
		get defaultRateLimitStore() {
			return store.current;
		},
	};
});

const { createMemoryRateLimitStore } = await import("@fuutu/utils/rate-limit");
const { handleMcpRequest } = await import("../mcp");

const invalidKey = () =>
	new Response(JSON.stringify({ error: "invalid_api_key" }), { status: 401 });

function mcpRequest(
	headers: Record<string, string>,
	ip = "203.0.113.7",
): Request {
	return new Request("http://localhost/api/mcp", {
		method: "POST",
		headers: { "x-forwarded-for": ip, ...headers },
		body: "{}",
	});
}

const validToken = { authorization: "Bearer futu_sk_valid" };
const principal = {
	kind: "user",
	via: "api-key",
	credentialId: "key-1",
	userId: "user-9",
	organizationId: "org-1",
	orgRole: "owner",
	systemRole: null,
	scopes: ["mcp"],
};

const randomToken = () => ({
	authorization: `Bearer futu_sk_${crypto.randomUUID()}`,
});

beforeEach(() => {
	store.current = createMemoryRateLimitStore();
	resolvePrincipal.mockReset();
	resolvePrincipal.mockImplementation(async () => invalidKey());
	config.apiConfig.rateLimit.enabled = true;
	config.apiConfig.rateLimit.trustProxyHeaders = true;
});

describe("MCP pre-auth throttle", () => {
	it("returns 429 to a random-token flood and stops calling the lookup", async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 6; i++) {
			statuses.push((await handleMcpRequest(mcpRequest(randomToken()))).status);
		}
		expect(statuses).toEqual([401, 401, 401, 429, 429, 429]);
		expect(resolvePrincipal).toHaveBeenCalledTimes(3);
	});

	it("sends Retry-After with the 429", async () => {
		for (let i = 0; i < 3; i++) {
			await handleMcpRequest(mcpRequest(randomToken()));
		}
		const res = await handleMcpRequest(mcpRequest(randomToken()));
		expect(res.status).toBe(429);
		expect(res.headers.get("retry-after")).toBe("60");
	});

	it("counts x-api-key credentials too", async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 4; i++) {
			const res = await handleMcpRequest(
				mcpRequest({ "x-api-key": `futu_sk_${i}` }),
			);
			statuses.push(res.status);
		}
		expect(statuses.at(-1)).toBe(429);
		expect(resolvePrincipal).toHaveBeenCalledTimes(3);
	});

	it("throttles each client IP separately", async () => {
		for (let i = 0; i < 4; i++) {
			await handleMcpRequest(mcpRequest(randomToken(), "203.0.113.7"));
		}
		const other = await handleMcpRequest(
			mcpRequest(randomToken(), "198.51.100.9"),
		);
		expect(other.status).toBe(401);
	});

	it("does not count requests without a credential", async () => {
		resolvePrincipal.mockImplementation(
			async () => new Response("anonymous", { status: 418 }),
		);
		for (let i = 0; i < 5; i++) {
			expect((await handleMcpRequest(mcpRequest({}))).status).toBe(418);
		}
		expect(resolvePrincipal).toHaveBeenCalledTimes(5);
	});

	it("never throttles when the client IP is not trusted", async () => {
		config.apiConfig.rateLimit.trustProxyHeaders = false;
		const statuses = new Set<number>();
		for (let i = 0; i < 10; i++) {
			const ip = `198.51.100.${i}`; // ignored — forwarding headers untrusted
			statuses.add(
				(await handleMcpRequest(mcpRequest(randomToken(), ip))).status,
			);
		}
		expect([...statuses]).toEqual([401]);
		expect(resolvePrincipal).toHaveBeenCalledTimes(10);
	});

	it("never counts valid credentials against the failure budget", async () => {
		resolvePrincipal.mockImplementation(async () => principal);
		for (let i = 0; i < 10; i++) {
			await handleMcpRequest(mcpRequest(validToken));
		}
		resolvePrincipal.mockImplementation(async () => invalidKey());
		const statuses: number[] = [];
		for (let i = 0; i < 4; i++) {
			statuses.push((await handleMcpRequest(mcpRequest(randomToken()))).status);
		}
		expect(statuses).toEqual([401, 401, 401, 429]);
	});

	it("does not count a valid key that is plan-gated (402)", async () => {
		resolvePrincipal.mockImplementation(
			async () =>
				new Response(JSON.stringify({ error: "upgrade_required" }), {
					status: 402,
				}),
		);
		for (let i = 0; i < 5; i++) {
			expect((await handleMcpRequest(mcpRequest(validToken))).status).toBe(402);
		}
		expect(resolvePrincipal).toHaveBeenCalledTimes(5);
	});

	it("blocks valid credentials from an IP that is over its failure budget", async () => {
		for (let i = 0; i < 3; i++) {
			await handleMcpRequest(mcpRequest(randomToken()));
		}
		resolvePrincipal.mockImplementation(async () => principal);
		expect((await handleMcpRequest(mcpRequest(validToken))).status).toBe(429);
		expect(resolvePrincipal).toHaveBeenCalledTimes(3);
	});

	it("is off when rate limiting is disabled", async () => {
		config.apiConfig.rateLimit.enabled = false;
		for (let i = 0; i < 6; i++) {
			expect((await handleMcpRequest(mcpRequest(randomToken()))).status).toBe(
				401,
			);
		}
		expect(resolvePrincipal).toHaveBeenCalledTimes(6);
	});
});
