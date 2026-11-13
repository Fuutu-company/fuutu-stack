import type { Context as HonoContext } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A presented API key costs a DB lookup (verifyApiKeyCredential) before the
 * oRPC rate limit can run — so createContext counts FAILED key checks per
 * trusted client IP. Random-key floods get 429 and stop reaching the
 * lookup; valid keys never consume the budget, but once the IP is blocked
 * for failures they get 429 too until the window resets. Without a trusted
 * client IP nothing is throttled here (the regular rate limits still run).
 */

vi.mock("@fuutu/auth", () => ({
	auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@fuutu/db", () => ({ API_KEY_PREFIX: "futu_sk_" }));

vi.mock("../modules/api-keys/verify-credential", () => ({
	verifyApiKeyCredential: vi.fn(),
}));

const trust = vi.hoisted(() => ({ proxyHeaders: true }));
vi.mock("../config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config")>();
	return {
		...actual,
		apiConfig: {
			...actual.apiConfig,
			rateLimit: {
				...actual.apiConfig.rateLimit,
				enabled: true,
				get trustProxyHeaders() {
					return trust.proxyHeaders;
				},
				preAuth: { maxRequests: 3, windowMs: 60_000 },
			},
		},
	};
});

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
const { auth } = await import("@fuutu/auth");
const { verifyApiKeyCredential } = await import(
	"../modules/api-keys/verify-credential"
);
const { createContext } = await import("../context");
const { protectedProcedure, publicProcedure } = await import(
	"../orpc/procedures"
);
const { call } = await import("@orpc/server");

const fakeHonoContext = (headers: Headers) =>
	({ req: { raw: { headers } } }) as unknown as HonoContext;

const whoami = protectedProcedure.handler(({ context }) => context.user.id);
const ping = publicProcedure.handler(() => "pong");

const IP = "203.0.113.7";

function headersWith(extra: Record<string, string>, ip: string = IP): Headers {
	return new Headers({ "x-forwarded-for": ip, ...extra });
}

const randomKey = () => ({ "x-api-key": `futu_sk_${crypto.randomUUID()}` });

async function callWith(headers: Headers) {
	const context = await createContext({ context: fakeHonoContext(headers) });
	return call(whoami, undefined, { context });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
	return promise.then(
		() => "OK",
		(e: { code?: string }) => e.code ?? String(e),
	);
}

const validCredential = {
	apiKey: { id: "key-1", organizationId: null, scopes: [] },
	user: { id: "user-9", email: "u@example.com", banned: false },
	orgRole: null,
};

beforeEach(() => {
	vi.clearAllMocks();
	trust.proxyHeaders = true;
	store.current = createMemoryRateLimitStore();
	vi.mocked(auth.api.getSession).mockResolvedValue(null);
	vi.mocked(verifyApiKeyCredential).mockResolvedValue(null);
});

describe("createContext — pre-auth throttle", () => {
	it("answers 429 to a random-key flood and stops verifying keys", async () => {
		const codes: string[] = [];
		for (let i = 0; i < 5; i++) {
			codes.push(await codeOf(callWith(headersWith(randomKey()))));
		}
		expect(codes).toEqual([
			"UNAUTHORIZED",
			"UNAUTHORIZED",
			"UNAUTHORIZED",
			"TOO_MANY_REQUESTS",
			"TOO_MANY_REQUESTS",
		]);
		expect(verifyApiKeyCredential).toHaveBeenCalledTimes(3);
	});

	it("sends the 429 with HTTP status 429 on public procedures too", async () => {
		for (let i = 0; i < 3; i++) {
			await createContext({
				context: fakeHonoContext(headersWith(randomKey())),
			});
		}
		const context = await createContext({
			context: fakeHonoContext(headersWith(randomKey())),
		});
		await expect(call(ping, undefined, { context })).rejects.toMatchObject({
			code: "TOO_MANY_REQUESTS",
			status: 429,
		});
	});

	it("counts bearer API keys too", async () => {
		for (let i = 0; i < 3; i++) {
			await callWith(
				headersWith({ authorization: `Bearer futu_sk_${i}` }),
			).catch(() => undefined);
		}
		expect(
			await codeOf(
				callWith(headersWith({ authorization: "Bearer futu_sk_x" })),
			),
		).toBe("TOO_MANY_REQUESTS");
		expect(verifyApiKeyCredential).toHaveBeenCalledTimes(3);
	});

	it("does not authenticate a valid key once the IP is throttled", async () => {
		for (let i = 0; i < 3; i++) {
			await callWith(headersWith(randomKey())).catch(() => undefined);
		}
		vi.mocked(verifyApiKeyCredential).mockResolvedValue(
			validCredential as never,
		);
		const ctx = await createContext({
			context: fakeHonoContext(headersWith({ "x-api-key": "futu_sk_valid" })),
		});
		expect(ctx.session).toBeNull();
		expect(ctx.apiKey).toBeNull();
		expect(verifyApiKeyCredential).toHaveBeenCalledTimes(3);
	});

	it("accepts a valid key under the limit", async () => {
		vi.mocked(verifyApiKeyCredential).mockResolvedValue(
			validCredential as never,
		);
		await expect(
			callWith(headersWith({ "x-api-key": "futu_sk_valid" })),
		).resolves.toBe("user-9");
		expect(verifyApiKeyCredential).toHaveBeenCalledWith("futu_sk_valid");
	});

	it("leaves session callers unaffected after the IP is throttled", async () => {
		for (let i = 0; i < 4; i++) {
			await callWith(headersWith(randomKey())).catch(() => undefined);
		}
		vi.mocked(auth.api.getSession).mockResolvedValue({
			user: { id: "user-1", banned: false },
			session: { id: "sess-1" },
		} as never);
		await expect(callWith(headersWith(randomKey()))).resolves.toBe("user-1");
		await expect(callWith(headersWith({}))).resolves.toBe("user-1");
	});

	it("does not count requests without a credential", async () => {
		for (let i = 0; i < 5; i++) {
			await callWith(headersWith({})).catch(() => undefined);
		}
		vi.mocked(verifyApiKeyCredential).mockResolvedValue(
			validCredential as never,
		);
		await expect(
			callWith(headersWith({ "x-api-key": "futu_sk_valid" })),
		).resolves.toBe("user-9");
	});

	it("never counts valid keys against the failure budget", async () => {
		vi.mocked(verifyApiKeyCredential).mockResolvedValue(
			validCredential as never,
		);
		for (let i = 0; i < 10; i++) {
			await expect(
				callWith(headersWith({ "x-api-key": "futu_sk_valid" })),
			).resolves.toBe("user-9");
		}
		vi.mocked(verifyApiKeyCredential).mockResolvedValue(null);
		const codes: string[] = [];
		for (let i = 0; i < 4; i++) {
			codes.push(await codeOf(callWith(headersWith(randomKey()))));
		}
		expect(codes).toEqual([
			"UNAUTHORIZED",
			"UNAUTHORIZED",
			"UNAUTHORIZED",
			"TOO_MANY_REQUESTS",
		]);
	});

	describe("once the IP is blocked for failures", () => {
		beforeEach(() => {
			vi.useFakeTimers({ toFake: ["Date"] });
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("blocks valid keys from it too, until the window resets", async () => {
			for (let i = 0; i < 3; i++) {
				await callWith(headersWith(randomKey())).catch(() => undefined);
			}
			vi.mocked(verifyApiKeyCredential).mockResolvedValue(
				validCredential as never,
			);
			const valid = () =>
				callWith(headersWith({ "x-api-key": "futu_sk_valid" }));
			expect(await codeOf(valid())).toBe("TOO_MANY_REQUESTS");

			vi.advanceTimersByTime(60_000);
			await expect(valid()).resolves.toBe("user-9");
		});
	});

	it("never throttles when the client IP is not trusted", async () => {
		trust.proxyHeaders = false;
		const codes = new Set<string>();
		for (let i = 0; i < 10; i++) {
			codes.add(
				await codeOf(callWith(headersWith(randomKey(), `198.51.100.${i}`))),
			);
		}
		expect([...codes]).toEqual(["UNAUTHORIZED"]);
		expect(verifyApiKeyCredential).toHaveBeenCalledTimes(10);

		vi.mocked(verifyApiKeyCredential).mockResolvedValue(
			validCredential as never,
		);
		await expect(
			callWith(headersWith({ "x-api-key": "futu_sk_valid" })),
		).resolves.toBe("user-9");
	});

	it("throttles each client IP separately", async () => {
		for (let i = 0; i < 4; i++) {
			await callWith(headersWith(randomKey())).catch(() => undefined);
		}
		expect(
			await codeOf(callWith(headersWith(randomKey(), "198.51.100.9"))),
		).toBe("UNAUTHORIZED");
	});
});
