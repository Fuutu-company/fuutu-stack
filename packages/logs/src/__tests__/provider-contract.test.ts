import { describe, expect, it } from "vitest";
import type { AuditEvent, AuditSink, LogLevel, LogProvider } from "../types";

export interface LogProviderContractOptions {
	/** Whether log() throws or is silent. */
	readonly behavior: "silent" | "throws";
	/** Substring expected in the thrown error message (skeletons). */
	readonly throwsContains?: string;
}

/**
 * Shared contract every LogProvider must satisfy.
 * Called from one test file per provider so every swap candidate is covered.
 */
export function testLogProviderContract(
	name: string,
	createProvider: () => LogProvider,
	options: LogProviderContractOptions,
): void {
	const levels: LogLevel[] = ["debug", "info", "warn", "error"];

	describe(`LogProvider contract — ${name}`, () => {
		for (const level of levels) {
			if (options.behavior === "silent") {
				it(`log(${level}) does not throw`, () => {
					const provider = createProvider();
					expect(() =>
						provider.log(level, "test message", { scope: "test" }),
					).not.toThrow();
				});
			} else {
				it(`log(${level}) throws`, () => {
					const provider = createProvider();
					expect(() =>
						provider.log(level, "test message", { scope: "test" }),
					).toThrow(options.throwsContains ?? "not implemented");
				});
			}
		}
	});
}

export interface AuditSinkContractOptions {
	/** Whether record() resolves or throws. */
	readonly behavior: "resolves" | "throws";
	/** Substring expected in the thrown error message (skeletons). */
	readonly throwsContains?: string;
}

/**
 * Shared contract every AuditSink must satisfy.
 */
export function testAuditSinkContract(
	name: string,
	createSink: () => AuditSink,
	options: AuditSinkContractOptions,
): void {
	const event: AuditEvent = {
		action: "test.action",
		userId: "user_test",
	};

	describe(`AuditSink contract — ${name}`, () => {
		if (options.behavior === "resolves") {
			it("record() resolves for a valid AuditEvent", async () => {
				const sink = createSink();
				await expect(sink.record(event)).resolves.toBeUndefined();
			});
		} else {
			it("record() throws for a valid AuditEvent", async () => {
				const sink = createSink();
				await expect((async () => sink.record(event))()).rejects.toThrow(
					options.throwsContains ?? "not implemented",
				);
			});
		}
	});
}
