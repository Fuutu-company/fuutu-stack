import type { DrainContext, LoggerConfig } from "evlog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spy on initLogger while keeping the real implementation so emits still
// reach the drains that initLogs attaches.
const { initLoggerSpy } = vi.hoisted(() => ({ initLoggerSpy: vi.fn() }));
vi.mock("evlog", async (importOriginal) => {
	const actual = await importOriginal<typeof import("evlog")>();
	initLoggerSpy.mockImplementation(actual.initLogger);
	return { ...actual, initLogger: initLoggerSpy };
});

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

describe("initLogs", () => {
	beforeEach(() => {
		vi.resetModules();
		initLoggerSpy.mockClear();
		delete process.env.LOG_DRAIN;
		delete process.env.LOG_LEVEL;
	});

	afterEach(() => {
		vi.doUnmock("evlog/memory");
		vi.restoreAllMocks();
		delete process.env.LOG_DRAIN;
		delete process.env.LOG_LEVEL;
	});

	it("initializes evlog without a drain when LOG_DRAIN is unset", async () => {
		const { initLogs } = await import("../server");
		await initLogs();

		expect(initLoggerSpy).toHaveBeenCalledOnce();
		const config = initLoggerSpy.mock.calls[0]?.[0] as LoggerConfig;
		expect(config.drain).toBeUndefined();
	});

	it("attaches the configured drain and it actually receives events", async () => {
		process.env.LOG_DRAIN = "memory";
		const { initLogs } = await import("../server");
		const { clearMemoryLogs, readMemoryLogs } = await import("evlog/memory");
		clearMemoryLogs();

		await initLogs();

		const config = initLoggerSpy.mock.calls[0]?.[0] as LoggerConfig;
		expect(typeof config.drain).toBe("function");

		await config.drain?.(makeCtx({ message: "init-attach-proof" }));
		expect(
			readMemoryLogs().some((e) => e.message === "init-attach-proof"),
		).toBe(true);
	});

	it("wires LOG_LEVEL through to evlog minLevel", async () => {
		process.env.LOG_LEVEL = "warn";
		const { initLogs } = await import("../server");
		await initLogs();

		const config = initLoggerSpy.mock.calls[0]?.[0] as LoggerConfig;
		expect(config.minLevel).toBe("warn");
	});

	it("warns when drains are configured but none could attach", async () => {
		vi.doMock("evlog/memory", () => ({
			createMemoryDrain: () => {
				throw new Error("boom");
			},
		}));
		process.env.LOG_DRAIN = "memory";
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		const { initLogs } = await import("../server");
		await initLogs();

		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("no drain attached"),
		);
		const config = initLoggerSpy.mock.calls[0]?.[0] as LoggerConfig;
		expect(config.drain).toBeUndefined();
	});

	it("is idempotent — second call is a no-op", async () => {
		const { initLogs } = await import("../server");
		await initLogs();
		await initLogs();
		expect(initLoggerSpy).toHaveBeenCalledOnce();
	});

	it("dedupes concurrent calls into a single init", async () => {
		const { initLogs } = await import("../server");
		await Promise.all([initLogs(), initLogs(), initLogs()]);
		expect(initLoggerSpy).toHaveBeenCalledOnce();
	});

	it("locks the logger so a later createEvlog() can't wipe the drain", async () => {
		process.env.LOG_DRAIN = "memory";
		const { initLogs } = await import("../server");
		const { clearMemoryLogs, readMemoryLogs } = await import("evlog/memory");
		clearMemoryLogs();
		await initLogs();

		// Route modules call createEvlog() at scope — its configureHandler()
		// re-runs initLogger (last-call-wins) unless the logger is locked.
		const { createEvlog } = await import("evlog/next");
		createEvlog({ service: "spoof" });

		// If the implicit init was skipped, the initLogs-configured drain
		// still receives events.
		const { log } = await import("evlog");
		log.info({ message: "post-createevlog" });
		// Drains run async — flush microtasks before asserting delivery.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(readMemoryLogs().some((e) => e.message === "post-createevlog")).toBe(
			true,
		);
	});

	it("retries after a failed init instead of staying uninitialized", async () => {
		initLoggerSpy.mockImplementationOnce(() => {
			throw new Error("boom");
		});
		const { initLogs } = await import("../server");

		await expect(initLogs()).rejects.toThrow("boom");
		await expect(initLogs()).resolves.toBeUndefined();
		expect(initLoggerSpy).toHaveBeenCalledTimes(2);
	});
});
