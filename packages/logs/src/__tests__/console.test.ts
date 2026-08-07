import { describe, expect, it, vi } from "vitest";
import { consoleProvider } from "../providers/console";
import { consoleAuditSink } from "../sinks/console";
import {
	testAuditSinkContract,
	testLogProviderContract,
} from "./provider-contract.test";

testLogProviderContract("console", () => consoleProvider, {
	behavior: "silent",
});

testAuditSinkContract("console", () => consoleAuditSink, {
	behavior: "resolves",
});

describe("console LogProvider — output surface", () => {
	it("writes to the matching console method", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleProvider.log("info", "hello", { scope: "test" });
		expect(infoSpy).toHaveBeenCalledWith("[test]", "hello");
		infoSpy.mockRestore();
	});

	it("includes meta when present", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		consoleProvider.log("warn", "careful", { scope: "x", meta: { a: 1 } });
		expect(warnSpy).toHaveBeenCalledWith("[x]", "careful", { a: 1 });
		warnSpy.mockRestore();
	});
});

describe("console AuditSink — output surface", () => {
	it("writes an [audit] info line", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		await consoleAuditSink.record({
			action: "auth.sign_in",
			userId: "u1",
			ip: "127.0.0.1",
		});
		expect(infoSpy).toHaveBeenCalledOnce();
		infoSpy.mockRestore();
	});
});
