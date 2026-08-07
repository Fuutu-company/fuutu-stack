import { createMock } from "@fuutu/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "../types";

vi.mock("@fuutu/env/saas", () => ({
	env: {
		PLUNK_API_KEY: "test-plunk-key",
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

// Import AFTER the mock is registered so the provider picks up the stub.
const { plunkProvider } = await import("../providers/plunk");
const { testEmailProviderContract } = await import("./provider-contract.test");

testEmailProviderContract("plunk", () => plunkProvider, {
	sendBehavior: "resolves",
});

describe("plunk provider — fetch integration", () => {
	it("POSTs to the Plunk endpoint and resolves on 200", async () => {
		const message = createMock<EmailMessage>({
			from: "noreply@fuutu.test",
			to: "user@fuutu.test",
			subject: "Plunk test",
			html: "<p>Plunk</p>",
			text: "Plunk",
		});

		await expect(plunkProvider.send(message)).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.useplunk.com/v1/send");
		expect(init.method).toBe("POST");
		const headers = init.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer test-plunk-key");
	});

	it("throws when Plunk returns a non-2xx status", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response("bad request", { status: 400 }),
		);
		const message = createMock<EmailMessage>({
			from: "noreply@fuutu.test",
			to: "user@fuutu.test",
			subject: "Plunk fail",
			html: "<p>fail</p>",
			text: "fail",
		});

		await expect(plunkProvider.send(message)).rejects.toThrow(
			"send failed with status 400",
		);
	});
});
