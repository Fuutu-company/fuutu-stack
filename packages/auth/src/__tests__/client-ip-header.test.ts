import { describe, expect, it } from "vitest";
import { CLIENT_IP_HEADER, withClientIp } from "../client-ip-header";

const request = (headers: Record<string, string>) =>
	new Request("http://localhost:3000/api/auth/sign-in/email", {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify({ email: "a@b.dev", password: "x" }),
	});

describe("withClientIp", () => {
	it("drops a client-sent copy of the header when no IP can be trusted", () => {
		const forwarded = withClientIp(
			request({ [CLIENT_IP_HEADER]: "6.6.6.6" }),
			null,
		);
		expect(forwarded.headers.has(CLIENT_IP_HEADER)).toBe(false);
	});

	it("overwrites a client-sent copy with the trusted IP", () => {
		const forwarded = withClientIp(
			request({ [CLIENT_IP_HEADER]: "6.6.6.6" }),
			"203.0.113.7",
		);
		expect(forwarded.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
	});

	it("keeps method, URL, other headers and the body", async () => {
		const forwarded = withClientIp(
			request({ origin: "http://localhost:3000" }),
			"203.0.113.7",
		);
		expect(forwarded.method).toBe("POST");
		expect(forwarded.url).toBe("http://localhost:3000/api/auth/sign-in/email");
		expect(forwarded.headers.get("origin")).toBe("http://localhost:3000");
		expect(await forwarded.json()).toEqual({ email: "a@b.dev", password: "x" });
	});

	it("is the only header Better Auth reads the client IP from", async () => {
		const { authIpAddressOptions } = await import("../client-ip-header");
		expect(authIpAddressOptions.ipAddressHeaders).toEqual([CLIENT_IP_HEADER]);
	});
});
