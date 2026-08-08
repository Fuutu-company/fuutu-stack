import { createMock } from "@fuutu/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "../types";

vi.mock("@fuutu/env/saas", () => ({
	env: {
		RESEND_API_KEY: "test-resend-key",
		NODE_ENV: "test",
	},
}));

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
	globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
	vi.restoreAllMocks();
});

const { resendProvider } = await import("../providers/resend");
const { testEmailProviderContract } = await import("./provider-contract.test");

testEmailProviderContract("resend", () => resendProvider, {
	sendBehavior: "resolves",
});

describe("resend provider — fetch integration", () => {
	it("POSTs to the Resend endpoint and resolves on 200", async () => {
		const message = createMock<EmailMessage>({
			from: "noreply@fuutu.test",
			to: "user@fuutu.test",
			subject: "Resend test",
			html: "<p>Resend</p>",
			text: "Resend",
		});

		await expect(resendProvider.send(message)).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.resend.com/emails");
		expect(init.method).toBe("POST");
		const headers = init.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer test-resend-key");
	});

	it("throws when Resend returns a non-2xx status", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response("unauthorized", { status: 401 }),
		);
		const message = createMock<EmailMessage>({
			from: "noreply@fuutu.test",
			to: "user@fuutu.test",
			subject: "Resend fail",
			html: "<p>fail</p>",
			text: "fail",
		});

		await expect(resendProvider.send(message)).rejects.toThrow(
			"send failed with status 401",
		);
	});
});
