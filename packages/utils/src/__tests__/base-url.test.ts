import { afterEach, describe, expect, it } from "vitest";
import { getBaseUrl } from "../base-url";

describe("getBaseUrl", () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("returns a valid URL string", () => {
		const url = getBaseUrl();
		expect(typeof url).toBe("string");
		expect(() => new URL(url)).not.toThrow();
	});

	it("returns localhost with default port when no env is set", () => {
		delete process.env.VERCEL_URL;
		delete process.env.PORT;
		expect(getBaseUrl()).toBe("http://localhost:3000");
	});

	it("respects custom defaultPort", () => {
		delete process.env.VERCEL_URL;
		delete process.env.PORT;
		expect(getBaseUrl({ defaultPort: 4000 })).toBe("http://localhost:4000");
	});

	it("uses PORT env when set", () => {
		delete process.env.VERCEL_URL;
		process.env.PORT = "8080";
		expect(getBaseUrl()).toBe("http://localhost:8080");
	});

	it("uses VERCEL_URL when set", () => {
		process.env.VERCEL_URL = "my-app.vercel.app";
		delete process.env.PORT;
		expect(getBaseUrl()).toBe("https://my-app.vercel.app");
	});

	it("override takes precedence over env", () => {
		process.env.VERCEL_URL = "my-app.vercel.app";
		expect(getBaseUrl({ override: "https://custom.example.com" })).toBe(
			"https://custom.example.com",
		);
	});

	it("strips trailing slash from override", () => {
		expect(getBaseUrl({ override: "https://custom.example.com/" })).toBe(
			"https://custom.example.com",
		);
	});
});
