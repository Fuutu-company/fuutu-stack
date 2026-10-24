import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/mail", () => ({
	sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fuutu/db", () => ({
	getUserById: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

import { getUserById } from "@fuutu/db";
import { sendEmail } from "@fuutu/mail";
import { emailChannel } from "../channels/email";

describe("EmailChannel", () => {
	beforeEach(() => {
		vi.mocked(sendEmail).mockClear();
		vi.mocked(getUserById).mockReset();
	});

	it("uses the explicit email from data when present", async () => {
		await emailChannel.send("user-1", "billing", "Invoice ready", "Body", {
			email: "override@example.com",
			name: "Alice",
			appUrl: "https://app.example.com",
		});

		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "override@example.com",
				subject: "Invoice ready",
				template: "notification",
				data: expect.objectContaining({
					name: "Alice",
					title: "Invoice ready",
					body: "Body",
				}),
			}),
		);
		expect(getUserById).not.toHaveBeenCalled();
	});

	it("resolves the recipient email from the user record", async () => {
		vi.mocked(getUserById).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "Bob",
			locale: "de",
		} as never);

		await emailChannel.send("user-1", "billing", "Reminder", "Body", {
			subscriptionId: "sub-1",
		});

		expect(getUserById).toHaveBeenCalledWith("user-1");
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				data: expect.objectContaining({ name: "Bob", locale: "de" }),
			}),
		);
	});

	it("prefers an explicit email override over the user record", async () => {
		vi.mocked(getUserById).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "Bob",
			locale: "en",
		} as never);

		await emailChannel.send("user-1", "billing", "Reminder", "Body", {
			email: "override@example.com",
		});

		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({ to: "override@example.com" }),
		);
	});

	it("drops an invalid data.locale when the user record has no usable locale", async () => {
		vi.mocked(getUserById).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "Bob",
			locale: null,
		} as never);

		await emailChannel.send("user-1", "system", "Hello", "Body", {
			locale: "fr",
		});

		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				data: expect.objectContaining({ locale: undefined }),
			}),
		);
	});

	it("skips send when no recipient can be resolved", async () => {
		vi.mocked(getUserById).mockResolvedValue(null);

		await emailChannel.send("ghost", "system", "No email", "Body");

		expect(sendEmail).not.toHaveBeenCalled();
	});
});
