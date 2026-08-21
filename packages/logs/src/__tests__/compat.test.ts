import { describe, expect, it, vi } from "vitest";

// Mock evlog's log so we can assert calls without real output.
// vi.mock is hoisted to top of file by Vitest, so we use a factory.
vi.mock("evlog", () => ({
	log: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
	initLogger: vi.fn(),
}));

import { log as evlogLog } from "evlog";
import { createLogger } from "../compat";

// Cast to Mock — vi.mock factory returns vi.fn() but TS infers evlog's
// real overloaded signature, which doesn't include mockClear/calledWith.
const mockLog = evlogLog as unknown as {
	info: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	debug: ReturnType<typeof vi.fn>;
};

describe("createLogger (compat facade)", () => {
	it("returns a Logger with all 4 levels", () => {
		const log = createLogger({ scope: "test" });
		expect(typeof log.debug).toBe("function");
		expect(typeof log.info).toBe("function");
		expect(typeof log.warn).toBe("function");
		expect(typeof log.error).toBe("function");
	});

	it("calls evlog.log.info(tag, message) without meta", () => {
		mockLog.info.mockClear();
		const log = createLogger({ scope: "ai:resolve" });
		log.info("model resolved");
		expect(mockLog.info).toHaveBeenCalledWith("ai:resolve", "model resolved");
	});

	it("calls evlog.log.info({ tag, message, ...meta }) with meta", () => {
		mockLog.info.mockClear();
		const log = createLogger({ scope: "ai:resolve" });
		log.info("model resolved", { model: "gpt-4o", latencyMs: 234 });
		expect(mockLog.info).toHaveBeenCalledWith({
			tag: "ai:resolve",
			message: "model resolved",
			model: "gpt-4o",
			latencyMs: 234,
		});
	});

	it("defaults scope to 'app' when not provided", () => {
		mockLog.warn.mockClear();
		const log = createLogger();
		log.warn("careful");
		expect(mockLog.warn).toHaveBeenCalledWith("app", "careful");
	});

	it("handles empty meta object (falls back to tag+message form)", () => {
		mockLog.error.mockClear();
		const log = createLogger({ scope: "x" });
		log.error("failed", {});
		expect(mockLog.error).toHaveBeenCalledWith("x", "failed");
	});

	it("delegates all levels correctly", () => {
		mockLog.debug.mockClear();
		mockLog.info.mockClear();
		mockLog.warn.mockClear();
		mockLog.error.mockClear();

		const log = createLogger({ scope: "s" });
		log.debug("d");
		log.info("i");
		log.warn("w");
		log.error("e");

		expect(mockLog.debug).toHaveBeenCalledWith("s", "d");
		expect(mockLog.info).toHaveBeenCalledWith("s", "i");
		expect(mockLog.warn).toHaveBeenCalledWith("s", "w");
		expect(mockLog.error).toHaveBeenCalledWith("s", "e");
	});
});
