import { createMock } from "@fuutu/test-utils";
import { describe, expect, it, vi } from "vitest";

// Force the console log provider so the spy on console.info captures the
// email box output. The default provider is now evlog (config-driven), which
// does not call console.info directly.
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: (msg: string) => console.info(msg),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

const { consoleProvider } = await import("../providers/console");
const { testEmailProviderContract } = await import("./provider-contract.test");
type EmailMessage = import("../types").EmailMessage;

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
		expect(infoSpy.mock.calls[0]?.join(" ")).toContain("EMAIL"); // guaranteed by toHaveBeenCalledOnce
		infoSpy.mockRestore();
	});
});
