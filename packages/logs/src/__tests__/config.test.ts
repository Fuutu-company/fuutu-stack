import { afterEach, describe, expect, it, vi } from "vitest";
import { logsConfig } from "../config";

const ORIGINAL = {
	LOG_DRAIN: process.env.LOG_DRAIN,
	LOG_AUDIT_SINK: process.env.LOG_AUDIT_SINK,
	LOG_LEVEL: process.env.LOG_LEVEL,
};

afterEach(() => {
	for (const [k, v] of Object.entries(ORIGINAL)) {
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	}
});

describe("logsConfig", () => {
	it("defaults to no extra drains, console audit sink, info level", () => {
		delete process.env.LOG_DRAIN;
		delete process.env.LOG_AUDIT_SINK;
		delete process.env.LOG_LEVEL;
		expect(logsConfig.drains).toEqual([]);
		expect(logsConfig.auditSink).toBe("console");
		expect(logsConfig.level).toBe("info");
	});

	it("parses single drain from LOG_DRAIN", () => {
		process.env.LOG_DRAIN = "sentry";
		expect(logsConfig.drains).toEqual(["sentry"]);
	});

	it("parses multiple comma-separated drains", () => {
		process.env.LOG_DRAIN = "sentry,fs";
		expect(logsConfig.drains).toEqual(["sentry", "fs"]);
	});

	it("filters out 'console' from drains (always on by default)", () => {
		process.env.LOG_DRAIN = "console,sentry";
		expect(logsConfig.drains).toEqual(["sentry"]);
	});

	it("ignores invalid drain names", () => {
		process.env.LOG_DRAIN = "bogus,sentry";
		expect(logsConfig.drains).toEqual(["sentry"]);
	});

	it("handles empty LOG_DRAIN", () => {
		process.env.LOG_DRAIN = "";
		expect(logsConfig.drains).toEqual([]);
	});

	it("reads auditSink from env", () => {
		process.env.LOG_AUDIT_SINK = "db";
		expect(logsConfig.auditSink).toBe("db");
	});

	it("reads level from env", () => {
		process.env.LOG_LEVEL = "debug";
		expect(logsConfig.level).toBe("debug");
	});

	it("rejects audit sink values with no implementation", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		process.env.LOG_AUDIT_SINK = "axiom";
		expect(logsConfig.auditSink).toBe("console");
		process.env.LOG_AUDIT_SINK = "noop";
		expect(logsConfig.auditSink).toBe("console");
		warn.mockRestore();
	});

	it("falls back to default on invalid auditSink", () => {
		process.env.LOG_AUDIT_SINK = "bogus";
		expect(logsConfig.auditSink).toBe("console");
	});

	it("warns on invalid LOG_AUDIT_SINK (consistent with parseDrains)", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		process.env.LOG_AUDIT_SINK = "bogus";
		expect(logsConfig.auditSink).toBe("console");
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("LOG_AUDIT_SINK"),
		);
		warn.mockRestore();
	});

	it("warns on invalid LOG_LEVEL", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		process.env.LOG_LEVEL = "bogus";
		expect(logsConfig.level).toBe("info");
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("LOG_LEVEL"));
		warn.mockRestore();
	});
});
