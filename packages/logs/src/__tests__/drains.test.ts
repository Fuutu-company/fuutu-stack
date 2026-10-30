import type { DrainContext } from "evlog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeCtx(event: Record<string, unknown>): DrainContext {
	return {
		event: {
			timestamp: new Date().toISOString(),
			level: "info",
			service: "test",
			environment: "test",
			...event,
		},
	};
}

describe("resolveDrains", () => {
	beforeEach(() => {
		vi.resetModules();
		delete process.env.LOG_DRAIN;
	});

	afterEach(() => {
		vi.doUnmock("evlog/memory");
		vi.restoreAllMocks();
		delete process.env.LOG_DRAIN;
	});

	it("resolves to an empty array when LOG_DRAIN is unset", async () => {
		const { resolveDrains } = await import("../drains");
		await expect(resolveDrains()).resolves.toEqual([]);
	});

	it("attaches the memory drain and the drain actually receives events", async () => {
		process.env.LOG_DRAIN = "memory";
		const { combineDrains, resolveDrains } = await import("../drains");
		const { clearMemoryLogs, readMemoryLogs } = await import("evlog/memory");
		clearMemoryLogs();

		const drains = await resolveDrains();
		expect(drains).toHaveLength(1);

		const drain = combineDrains(drains);
		expect(drain).toBeDefined();
		await drain?.(makeCtx({ message: "drain-proof" }));

		expect(readMemoryLogs().some((e) => e.message === "drain-proof")).toBe(
			true,
		);
	});

	it("warns and resolves to [] when a configured drain fails to load", async () => {
		vi.doMock("evlog/memory", () => ({
			createMemoryDrain: () => {
				throw new Error("boom");
			},
		}));
		process.env.LOG_DRAIN = "memory";
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		const { resolveDrains } = await import("../drains");
		const drains = await resolveDrains();

		expect(drains).toEqual([]);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Failed to load drain "memory"'),
			expect.anything(),
		);
	});

	it("warns once when drains are configured but none attached", async () => {
		vi.doMock("evlog/memory", () => ({
			createMemoryDrain: () => {
				throw new Error("boom");
			},
		}));
		process.env.LOG_DRAIN = "memory";
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		const { resolveDrains } = await import("../drains");
		await resolveDrains();
		await resolveDrains();

		const unattachedWarnings = warn.mock.calls.filter(([msg]) =>
			String(msg).includes("no drain attached"),
		);
		expect(unattachedWarnings).toHaveLength(1);
	});
});

describe("combineDrains", () => {
	it("returns undefined for an empty list", async () => {
		const { combineDrains } = await import("../drains");
		expect(combineDrains([])).toBeUndefined();
	});

	it("fans out to all drains", async () => {
		const { combineDrains } = await import("../drains");
		const a = vi.fn(async () => {});
		const b = vi.fn(async () => {});
		const drain = combineDrains([a, b]);
		await drain?.(makeCtx({ message: "fanout" }));
		expect(a).toHaveBeenCalledOnce();
		expect(b).toHaveBeenCalledOnce();
	});

	it("wraps a single drain so a throwing drain warns once and doesn't throw", async () => {
		const { combineDrains } = await import("../drains");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const bad = vi.fn(async () => {
			throw new Error("drain down");
		});
		const drain = combineDrains([bad]);

		await expect(drain?.(makeCtx({ message: "a" }))).resolves.toBeUndefined();
		await drain?.(makeCtx({ message: "b" }));

		const runtimeWarnings = warn.mock.calls.filter(([msg]) =>
			String(msg).includes("failed at runtime"),
		);
		expect(runtimeWarnings).toHaveLength(1);
		warn.mockRestore();
	});

	it("warns once per failing drain at runtime and keeps delivering", async () => {
		const { combineDrains } = await import("../drains");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const bad = vi.fn(async () => {
			throw new Error("drain down");
		});
		const good = vi.fn(async () => {});
		const drain = combineDrains([bad, good]);

		await drain?.(makeCtx({ message: "a" }));
		await drain?.(makeCtx({ message: "b" }));

		expect(good).toHaveBeenCalledTimes(2);
		const runtimeWarnings = warn.mock.calls.filter(([msg]) =>
			String(msg).includes("failed at runtime"),
		);
		expect(runtimeWarnings).toHaveLength(1);
	});
});
