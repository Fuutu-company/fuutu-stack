import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createMemoryRateLimitStore,
	createRedisRateLimitStore,
	defaultRateLimitStore,
} from "../rate-limit";

describe("createMemoryRateLimitStore", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000_000);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const limit = { maxRequests: 3, windowMs: 60_000 };

	it("allows the first request and reports remaining budget", async () => {
		const store = createMemoryRateLimitStore();
		const result = await store.check("k", limit);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(2);
		expect(result.resetAt).toBe(1_000_000 + 60_000);
	});

	it("decrements remaining on each subsequent request", async () => {
		const store = createMemoryRateLimitStore();
		await store.check("k", limit);
		const second = await store.check("k", limit);
		expect(second).toMatchObject({ allowed: true, remaining: 1 });
		const third = await store.check("k", limit);
		expect(third).toMatchObject({ allowed: true, remaining: 0 });
	});

	it("denies the request once the bucket is exhausted", async () => {
		const store = createMemoryRateLimitStore();
		await store.check("k", limit);
		await store.check("k", limit);
		await store.check("k", limit);
		const fourth = await store.check("k", limit);
		expect(fourth.allowed).toBe(false);
		expect(fourth.remaining).toBe(0);
		expect(fourth.resetAt).toBe(1_000_000 + 60_000);
	});

	it("keeps denying without consuming extra budget", async () => {
		const store = createMemoryRateLimitStore();
		for (let i = 0; i < limit.maxRequests; i++) await store.check("k", limit);
		const denied = await store.check("k", limit);
		expect(denied.allowed).toBe(false);
		// A denied check must not push resetAt forward or reset the window.
		const deniedAgain = await store.check("k", limit);
		expect(deniedAgain.resetAt).toBe(denied.resetAt);
	});

	it("resets the window after windowMs elapses", async () => {
		const store = createMemoryRateLimitStore();
		for (let i = 0; i < limit.maxRequests; i++) await store.check("k", limit);
		vi.setSystemTime(1_000_000 + 60_001);
		const fresh = await store.check("k", limit);
		expect(fresh).toMatchObject({ allowed: true, remaining: 2 });
		expect(fresh.resetAt).toBe(1_000_000 + 60_001 + 60_000);
	});

	it("allows a fresh window at the exact resetAt boundary (resetAt <= now)", async () => {
		const store = createMemoryRateLimitStore();
		for (let i = 0; i < limit.maxRequests; i++) await store.check("k", limit);
		vi.setSystemTime(1_000_000 + 60_000);
		const boundary = await store.check("k", limit);
		expect(boundary.allowed).toBe(true);
	});

	it("tracks buckets independently per key", async () => {
		const store = createMemoryRateLimitStore();
		for (let i = 0; i < limit.maxRequests; i++) await store.check("a", limit);
		const b = await store.check("b", limit);
		expect(b).toMatchObject({ allowed: true, remaining: 2 });
	});

	it("respects per-call limits", async () => {
		const store = createMemoryRateLimitStore();
		await store.check("k", limit);
		const stricter = await store.check("k", {
			maxRequests: 1,
			windowMs: 60_000,
		});
		expect(stricter.allowed).toBe(false);
	});
});

describe("createRedisRateLimitStore", () => {
	it("fails loud on check so production never runs un-rate-limited", async () => {
		const store = createRedisRateLimitStore({ url: "redis://localhost:6379" });
		await expect(
			store.check("k", { maxRequests: 1, windowMs: 1000 }),
		).rejects.toThrow("Redis driver is a v1 stub");
	});

	it("error tells the operator how to resolve it (implement or unset REDIS_URL)", async () => {
		const store = createRedisRateLimitStore({ url: "redis://localhost:6379" });
		await expect(
			store.check("k", { maxRequests: 1, windowMs: 1000 }),
		).rejects.toThrow("unset REDIS_URL");
	});
});

describe("defaultRateLimitStore", () => {
	it("is a shared memory store", async () => {
		const result = await defaultRateLimitStore.check("default-probe", {
			maxRequests: 1,
			windowMs: 1000,
		});
		expect(result.allowed).toBe(true);
		const denied = await defaultRateLimitStore.check("default-probe", {
			maxRequests: 1,
			windowMs: 1000,
		});
		expect(denied.allowed).toBe(false);
	});
});
