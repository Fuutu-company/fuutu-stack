import { describe, expect, it, vi } from "vitest";
import { getClientIp } from "../client-ip";

const config = vi.hoisted(() => ({
	rateLimit: {
		trustProxyHeaders: true,
		clientIpHeader: undefined as string | undefined,
	},
}));
vi.mock("../config", () => ({ apiConfig: config }));

const headers = new Headers({
	"cf-connecting-ip": " 198.51.100.4 ",
	// The CDN edge appends itself: the right-most entry is the edge, not
	// the client.
	"x-forwarded-for": "198.51.100.4, 172.68.1.1",
});

describe("getClientIp with a trusted client-IP header", () => {
	it("reads the configured header (e.g. CF-Connecting-IP behind Cloudflare)", () => {
		expect(getClientIp(headers, true, "cf-connecting-ip")).toBe("198.51.100.4");
	});

	it("uses apiConfig.rateLimit.clientIpHeader by default", () => {
		config.rateLimit.clientIpHeader = "cf-connecting-ip";
		expect(getClientIp(headers)).toBe("198.51.100.4");
		config.rateLimit.clientIpHeader = undefined;
		expect(getClientIp(headers)).toBe("172.68.1.1");
	});

	it("falls back to the right-most X-Forwarded-For entry when it is missing", () => {
		const viaProxy = new Headers({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" });
		expect(getClientIp(viaProxy, true, "cf-connecting-ip")).toBe("2.2.2.2");
	});

	it("is never read without trusted proxy headers", () => {
		expect(getClientIp(headers, false, "cf-connecting-ip")).toBeNull();
	});
});
