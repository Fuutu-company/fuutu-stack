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

	it("accepts an IPv6 client address", () => {
		const v6 = new Headers({ "cf-connecting-ip": "2001:db8::7" });
		expect(getClientIp(v6, true, "cf-connecting-ip")).toBe("2001:db8::7");
	});

	it.each([
		"198.51.100.4, 6.6.6.6", // a list, as X-Forwarded-For would carry
		"bucket-of-my-choice",
		"6.6.6.6:443",
	])(
		"ignores a value that is not one IP (%s) and falls back to X-Forwarded-For",
		(value) => {
			// A client-chosen string would get a rate-limit bucket of its own
			// (bypass, unbounded growth) when the origin is reachable without
			// the CDN.
			const forged = new Headers({
				"cf-connecting-ip": value,
				"x-forwarded-for": "6.6.6.6, 2.2.2.2",
			});
			expect(getClientIp(forged, true, "cf-connecting-ip")).toBe("2.2.2.2");
		},
	);
});

describe("getClientIp behind a reverse proxy", () => {
	it("reads the right-most X-Forwarded-For entry", () => {
		const viaProxy = new Headers({ "x-forwarded-for": "6.6.6.6, 2001:db8::9" });
		expect(getClientIp(viaProxy, true)).toBe("2001:db8::9");
	});

	it.each(["bucket-of-my-choice", "2.2.2.2:443", "unknown"])(
		"ignores a right-most X-Forwarded-For entry that is not one IP (%s)",
		(value) => {
			const forged = new Headers({ "x-forwarded-for": `6.6.6.6, ${value}` });
			expect(getClientIp(forged, true)).toBeNull();
		},
	);

	it("falls back to a valid X-Real-IP when X-Forwarded-For is not one IP", () => {
		const forged = new Headers({
			"x-forwarded-for": "bucket-of-my-choice",
			"x-real-ip": " 2.2.2.2 ",
		});
		expect(getClientIp(forged, true)).toBe("2.2.2.2");
	});

	it("reads X-Real-IP when there is no X-Forwarded-For", () => {
		expect(getClientIp(new Headers({ "x-real-ip": "2.2.2.2" }), true)).toBe(
			"2.2.2.2",
		);
	});

	it("ignores an X-Real-IP that is not one IP", () => {
		const forged = new Headers({ "x-real-ip": "bucket-of-my-choice" });
		expect(getClientIp(forged, true)).toBeNull();
	});
});
