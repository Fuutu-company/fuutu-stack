import { beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({ allowPrivateUrls: false }));
const lookupMock = vi.hoisted(() => vi.fn());

vi.mock("@fuutu/env/saas", () => ({
	env: {
		get WEBHOOK_ALLOW_PRIVATE_URLS() {
			return envState.allowPrivateUrls;
		},
	},
}));

vi.mock("node:dns/promises", () => ({
	lookup: (...args: unknown[]) => lookupMock(...args),
}));

import { validateWebhookUrl } from "../validate-url";

const PUBLIC_IP = { address: "93.184.216.34", family: 4 };

describe("validateWebhookUrl", () => {
	beforeEach(() => {
		envState.allowPrivateUrls = false;
		lookupMock.mockReset();
		lookupMock.mockResolvedValue([PUBLIC_IP]);
	});

	it("rejects malformed URLs", async () => {
		const result = await validateWebhookUrl("not-a-url");
		expect(result.valid).toBe(false);
		expect(result.reason).toBe("malformed URL");
	});

	it("rejects http:// without the private-URLs opt-in", async () => {
		const result = await validateWebhookUrl("http://example.com/hook");
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("HTTPS");
	});

	it("rejects non-http(s) protocols", async () => {
		const result = await validateWebhookUrl("file:///etc/passwd");
		expect(result.valid).toBe(false);
	});

	it("blocks literal private IPv4 without touching DNS", async () => {
		const result = await validateWebhookUrl("https://169.254.169.254/latest");
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("private/reserved");
		expect(lookupMock).not.toHaveBeenCalled();
	});

	it.each([
		"198.18.0.1", // benchmark range 198.18.0.0/15
		"198.19.255.255",
		"224.0.0.1", // multicast 224.0.0.0/4
		"239.255.255.255",
		"240.0.0.1", // reserved 240.0.0.0/4
		"255.255.255.255",
		"192.0.2.1", // TEST-NET-1 documentation range
		"203.0.113.9", // TEST-NET-3 documentation range
	])("blocks reserved IPv4 literal %s", async (ip) => {
		const result = await validateWebhookUrl(`https://${ip}/hook`);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("private/reserved");
	});

	it.each([
		"https://[::1]/hook", // loopback
		"https://[::]/hook", // unspecified
		"https://[fd00::1]/hook", // unique-local fc00::/7
		"https://[fe80::1]/hook", // link-local fe80::/10
		"https://[febf::1]/hook", // link-local upper bound of fe80::/10
		"https://[fec0::1]/hook", // site-local fec0::/10
		"https://[feff::1]/hook", // fe80::/9 remainder
		"https://[2001:db8::1]/hook", // documentation range
		"https://[64:ff9b::a9fe:a9fe]/hook", // NAT64 embedding 169.254.169.254
		"https://[2002:a9fe:a9fe::]/hook", // 6to4 embedding 169.254.169.254
	])("blocks reserved IPv6 literal %s", async (url) => {
		const result = await validateWebhookUrl(url);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("private/reserved");
	});

	it("blocks hostnames resolving to a private IP (nip.io-style DNS bypass)", async () => {
		lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);

		const result = await validateWebhookUrl(
			"https://169.254.169.254.nip.io/hook",
		);

		expect(result.valid).toBe(false);
		expect(result.reason).toContain("private/reserved");
	});

	it("blocks when ANY resolved IP is private (multi-A-record)", async () => {
		lookupMock.mockResolvedValue([
			PUBLIC_IP,
			{ address: "10.0.0.5", family: 4 },
		]);

		const result = await validateWebhookUrl("https://dual.example.com/hook");

		expect(result.valid).toBe(false);
		expect(result.reason).toContain("private/reserved");
	});

	it("blocks hostnames that fail to resolve", async () => {
		lookupMock.mockRejectedValue(new Error("ENOTFOUND"));

		const result = await validateWebhookUrl("https://nonexistent.invalid/hook");

		expect(result.valid).toBe(false);
		expect(result.reason).toContain("resolve");
	});

	it("blocks hostnames resolving only to private IPv6", async () => {
		lookupMock.mockResolvedValue([{ address: "fd00::10", family: 6 }]);

		const result = await validateWebhookUrl("https://v6.example.com/hook");

		expect(result.valid).toBe(false);
	});

	it("accepts a public https URL whose hostname resolves to public IPs", async () => {
		const result = await validateWebhookUrl("https://example.com/hook");

		expect(result.valid).toBe(true);
		expect(lookupMock).toHaveBeenCalledWith(
			"example.com",
			expect.objectContaining({ all: true }),
		);
	});

	it("accepts a public IP literal", async () => {
		const result = await validateWebhookUrl("https://93.184.216.34/hook");
		expect(result.valid).toBe(true);
		expect(lookupMock).not.toHaveBeenCalled();
	});

	describe("WEBHOOK_ALLOW_PRIVATE_URLS opt-in", () => {
		beforeEach(() => {
			envState.allowPrivateUrls = true;
		});

		it("allows http:// for local testing", async () => {
			const result = await validateWebhookUrl("http://localhost:3000/hook");
			expect(result.valid).toBe(true);
		});

		it("allows loopback/private targets for local receivers", async () => {
			expect(
				(await validateWebhookUrl("http://127.0.0.1:8787/hook")).valid,
			).toBe(true);
			expect((await validateWebhookUrl("http://192.168.1.20/hook")).valid).toBe(
				true,
			);
			lookupMock.mockResolvedValue([{ address: "::1", family: 6 }]);
			expect((await validateWebhookUrl("http://localhost/hook")).valid).toBe(
				true,
			);
		});

		it("still rejects non-http(s) schemes", async () => {
			expect((await validateWebhookUrl("file:///etc/passwd")).valid).toBe(
				false,
			);
		});
	});
});
