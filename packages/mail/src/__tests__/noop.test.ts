import { createMock } from "@fuutu/test-utils";
import { describe, expect, it, vi } from "vitest";
import { noopProvider } from "../providers/noop";
import type { EmailMessage } from "../types";
import { testEmailProviderContract } from "./provider-contract.test";

testEmailProviderContract("noop", () => noopProvider, {
	sendBehavior: "resolves",
});

describe("noop provider — test surface", () => {
	it("silently drops messages without logging", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const message = createMock<EmailMessage>({
			from: "noreply@fuutu.test",
			to: "user@fuutu.test",
			subject: "Test subject",
			html: "<p>Test</p>",
			text: "Test body",
		});
		await noopProvider.send(message);
		expect(logSpy).not.toHaveBeenCalled();
		expect(infoSpy).not.toHaveBeenCalled();
		logSpy.mockRestore();
		infoSpy.mockRestore();
	});
});
