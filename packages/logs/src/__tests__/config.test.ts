import { afterEach, describe, expect, it } from "vitest";
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

	it("falls back to default on invalid auditSink", () => {
		process.env.LOG_AUDIT_SINK = "bogus";
		expect(logsConfig.auditSink).toBe("console");
	});
});
