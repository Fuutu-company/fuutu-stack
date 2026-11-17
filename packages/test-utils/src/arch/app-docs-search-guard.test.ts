import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * The docs search endpoint (`apps/docs/src/lib/search-guard.ts`) is public:
 * over-long queries are refused before the index runs, and each client IP
 * (one shared bucket without trusted proxy headers) is rate limited.
 */

type Store = {
	check: (
		key: string,
		limit: { maxRequests: number; windowMs: number },
	) => Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
};
type Handler = (request: Request) => Promise<Response>;
type SearchGuard = {
	guardSearch: (
		handler: Handler,
		options: { trustProxyHeaders: boolean; store: Store },
	) => Handler;
};
type Limits = { createMemoryRateLimitStore: () => Store };

const guardPath = join(
	import.meta.dirname,
	"../../../../apps/docs/src/lib/search-guard.ts",
);
const limitPath = join(
	import.meta.dirname,
	"../../../../packages/utils/src/rate-limit.ts",
);
const { guardSearch } = (await import(
	/* @vite-ignore */ guardPath
)) as SearchGuard;
const { createMemoryRateLimitStore } = (await import(
	/* @vite-ignore */ limitPath
)) as Limits;

const search = (query: string, ip = "198.51.100.1") =>
	new Request(
		`http://docs.test/api/search?query=${encodeURIComponent(query)}`,
		{ headers: { "x-forwarded-for": ip } },
	);

function setup(trustProxyHeaders = true) {
	const handler = vi.fn<Handler>(async () => Response.json([]));
	const guarded = guardSearch(handler, {
		trustProxyHeaders,
		store: createMemoryRateLimitStore(),
	});
	return { handler, guarded };
}

describe("docs search guard", () => {
	it("passes a normal query to the index", async () => {
		const { handler, guarded } = setup();
		expect((await guarded(search("rate limit"))).status).toBe(200);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("refuses a query over 200 characters without searching", async () => {
		const { handler, guarded } = setup();
		expect((await guarded(search("a".repeat(200)))).status).toBe(200);
		const res = await guarded(search("a".repeat(201)));
		expect(res.status).toBe(400);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("limits each client IP to 60 searches a minute", async () => {
		const { handler, guarded } = setup();
		for (let i = 0; i < 60; i++) {
			expect((await guarded(search("q", "198.51.100.7"))).status).toBe(200);
		}
		const limited = await guarded(search("q", "198.51.100.7"));
		expect(limited.status).toBe(429);
		expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
		expect((await guarded(search("q", "198.51.100.8"))).status).toBe(200);
		expect(handler).toHaveBeenCalledTimes(61);
	});

	it("ignores forged forwarding headers without a trusted proxy", async () => {
		const { guarded } = setup(false);
		for (let i = 0; i < 60; i++) {
			await guarded(search("q", `203.0.113.${i}`));
		}
		expect((await guarded(search("q", "203.0.113.200"))).status).toBe(429);
	});
});
