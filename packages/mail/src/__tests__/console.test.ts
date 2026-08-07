import { createMock } from "@fuutu/test-utils";
import { describe, expect, it, vi } from "vitest";
import { consoleProvider } from "../providers/console";
import type { EmailMessage } from "../types";
import { testEmailProviderContract } from "./provider-contract.test";

testEmailProviderContract("console", () => consoleProvider, {
	sendBehavior: "resolves",
});

describe("console provider — dev surface", () => {
	it("logs a readable box to stdout", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const message = createMock<EmailMessage>({
			from: "noreply@fuutu.test",
			to: "user@fuutu.test",
			subject: "Test subject",
			html: "<p>Test</p>",
			text: "Test body",
		});
		await consoleProvider.send(message);
		expect(infoSpy).toHaveBeenCalledOnce();
		expect(infoSpy.mock.calls[0]!.join(" ")).toContain("EMAIL"); // guaranteed by toHaveBeenCalledOnce
		infoSpy.mockRestore();
	});
});
