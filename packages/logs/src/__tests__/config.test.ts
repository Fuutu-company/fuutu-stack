import { afterEach, describe, expect, it } from "vitest";
import { logsConfig } from "../config";

const ORIGINAL = {
	LOG_PROVIDER: process.env.LOG_PROVIDER,
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
	it("defaults to evlog/console/info when env unset", () => {
		delete process.env.LOG_PROVIDER;
		delete process.env.LOG_AUDIT_SINK;
		delete process.env.LOG_LEVEL;
		expect(logsConfig.provider).toBe("evlog");
		expect(logsConfig.auditSink).toBe("console");
		expect(logsConfig.level).toBe("info");
	});

	it("reads provider from env", () => {
		process.env.LOG_PROVIDER = "pino";
		expect(logsConfig.provider).toBe("pino");
	});

	it("reads auditSink from env", () => {
		process.env.LOG_AUDIT_SINK = "db";
		expect(logsConfig.auditSink).toBe("db");
	});

	it("reads level from env", () => {
		process.env.LOG_LEVEL = "debug";
		expect(logsConfig.level).toBe("debug");
	});

	it("falls back to default on invalid value", () => {
		process.env.LOG_PROVIDER = "bogus";
		expect(logsConfig.provider).toBe("evlog");
	});
});
