import { describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/mail", () => ({
	sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

import { sendEmail } from "@fuutu/mail";
import { emailChannel } from "../channels/email";

describe("EmailChannel", () => {
	it("calls sendEmail when email address is present in data", async () => {
		vi.mocked(sendEmail).mockClear();

		await emailChannel.send("user-1", "billing", "Invoice ready", "Body", {
			email: "user@example.com",
			name: "Alice",
			appUrl: "https://app.example.com",
		});

		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				subject: "Invoice ready",
				template: "notification",
				data: expect.objectContaining({
					title: "Invoice ready",
					body: "Body",
				}),
			}),
		);
	});

	it("skips send when no email address in data", async () => {
		vi.mocked(sendEmail).mockClear();

		await emailChannel.send("user-1", "system", "No email", "Body");

		expect(sendEmail).not.toHaveBeenCalled();
	});
});
