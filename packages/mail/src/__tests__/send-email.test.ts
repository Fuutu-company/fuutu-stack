import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/env/saas", () => ({
	env: {
		EMAIL_PROVIDER: "console",
		EMAIL_FROM: "Test <test@fuutu.test>",
		NODE_ENV: "test",
	},
}));

const { sendEmail } = await import("../send-email");
const { consoleProvider } = await import("../providers/console");

let sendSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	sendSpy = vi.spyOn(consoleProvider, "send").mockResolvedValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("sendEmail", () => {
	it("renders the template and calls provider.send with the resolved message", async () => {
		await sendEmail({
			to: "user@fuutu.test",
			template: "password-reset",
			data: { resetUrl: "https://app.test/reset?token=abc" },
		});

		expect(sendSpy).toHaveBeenCalledOnce();
		const message = sendSpy.mock.calls[0][0];
		expect(message.to).toBe("user@fuutu.test");
		expect(message.from).toBe("Test <test@fuutu.test>");
		expect(message.subject).toBeTruthy();
		expect(message.html).toContain("<!doctype html>");
		expect(message.text).toBeTruthy();
	});

	it("strips CR/LF from the final subject before handing it to the provider", async () => {
		await sendEmail({
			to: "user@fuutu.test",
			template: "password-reset",
			data: { resetUrl: "https://app.test/reset?token=abc" },
			subject: "Hello\r\nBCC: evil@test.dev\nWorld",
		});

		const message = sendSpy.mock.calls[0][0];
		expect(message.subject).toBe("Hello BCC: evil@test.dev World");
		expect(message.subject).not.toMatch(/[\r\n]/);
	});

	it("strips CR/LF from template-derived subjects (caller-controlled title)", async () => {
		await sendEmail({
			to: "user@fuutu.test",
			template: "notification",
			data: { title: "Hi\r\nInjected: yes", body: "body" },
		});

		const message = sendSpy.mock.calls[0][0];
		expect(message.subject).toBe("Hi Injected: yes");
		expect(message.subject).not.toMatch(/[\r\n]/);
	});

	it("uses options.from instead of the resolved default when provided", async () => {
		await sendEmail({
			to: "user@fuutu.test",
			template: "password-reset",
			data: { resetUrl: "https://app.test/reset?token=abc" },
			from: "Billing <billing@fuutu.test>",
		});

		expect(sendSpy.mock.calls[0][0].from).toBe("Billing <billing@fuutu.test>");
	});

	it("passes replyTo through to the provider", async () => {
		await sendEmail({
			to: "user@fuutu.test",
			template: "password-reset",
			data: { resetUrl: "https://app.test/reset?token=abc" },
			replyTo: "support@fuutu.test",
		});

		expect(sendSpy.mock.calls[0][0].replyTo).toBe("support@fuutu.test");
	});
});
