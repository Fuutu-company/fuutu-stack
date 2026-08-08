import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "../redirect";

describe("getSafeRedirect", () => {
	describe("valid relative paths", () => {
		it("returns a simple relative path", () => {
			expect(getSafeRedirect("/dashboard")).toBe("/dashboard");
		});

		it("returns a nested relative path", () => {
			expect(getSafeRedirect("/orgs/acme/settings")).toBe(
				"/orgs/acme/settings",
			);
		});

		it("returns path with query params", () => {
			expect(getSafeRedirect("/dashboard?tab=billing")).toBe(
				"/dashboard?tab=billing",
			);
		});

		it("returns path with hash fragment", () => {
			expect(getSafeRedirect("/docs#section-1")).toBe("/docs#section-1");
		});

		it("returns path with query and hash", () => {
			expect(getSafeRedirect("/search?q=hello#results")).toBe(
				"/search?q=hello#results",
			);
		});

		it("returns just slash", () => {
			expect(getSafeRedirect("/")).toBe("/");
		});
	});

	describe("valid absolute URLs on same host", () => {
		it("returns allowed-origin URL", () => {
			const url = "https://app.example.com/dashboard";
			expect(
				getSafeRedirect(url, {
					allowedOrigins: ["https://app.example.com"],
				}),
			).toBe(url);
		});

		it("returns allowed-origin URL with query params", () => {
			const url = "https://app.example.com/settings?tab=profile";
			expect(
				getSafeRedirect(url, {
					allowedOrigins: ["https://app.example.com"],
				}),
			).toBe(url);
		});

		it("rejects absolute URL when no origins are allow-listed", () => {
			expect(getSafeRedirect("https://app.example.com/dashboard")).toBe("/");
		});

		it("rejects absolute URL from a different origin", () => {
			expect(
				getSafeRedirect("https://evil.com/dashboard", {
					allowedOrigins: ["https://app.example.com"],
				}),
			).toBe("/");
		});
	});

	describe("open redirect prevention", () => {
		it("rejects external http URL", () => {
			expect(
				getSafeRedirect("http://evil.com", {
					allowedOrigins: ["https://app.example.com"],
				}),
			).toBe("/");
		});

		it("rejects external https URL", () => {
			expect(
				getSafeRedirect("https://evil.com/path", {
					allowedOrigins: ["https://app.example.com"],
				}),
			).toBe("/");
		});
	});

	describe("protocol-relative URLs", () => {
		it("rejects //evil.com", () => {
			expect(getSafeRedirect("//evil.com")).toBe("/");
		});

		it("rejects //evil.com/path", () => {
			expect(getSafeRedirect("//evil.com/path")).toBe("/");
		});

		it("rejects // with allowedOrigins set", () => {
			expect(
				getSafeRedirect("//evil.com", {
					allowedOrigins: ["https://app.example.com"],
				}),
			).toBe("/");
		});
	});

	describe("backslash bypass", () => {
		it("rejects /\\evil.com (backslash after slash)", () => {
			expect(getSafeRedirect("/\\evil.com")).toBe("/");
		});

		it("rejects /\\evil.com with allowedOrigins set", () => {
			expect(
				getSafeRedirect("/\\evil.com", {
					allowedOrigins: ["https://app.example.com"],
				}),
			).toBe("/");
		});

		it("rejects bare backslash-leading string", () => {
			expect(getSafeRedirect("\\evil.com")).toBe("/");
		});

		it("rejects /\\ with custom fallback", () => {
			expect(getSafeRedirect("/\\evil.com", { fallback: "/home" })).toBe(
				"/home",
			);
		});
	});

	describe("control-character bypass", () => {
		it("rejects /\\tevil.com (slash + tab)", () => {
			expect(getSafeRedirect("/\tevil.com")).toBe("/");
		});

		it("rejects /\\nevil.com (slash + newline)", () => {
			expect(getSafeRedirect("/\nevil.com")).toBe("/");
		});

		it("rejects / evil.com (slash + space)", () => {
			expect(getSafeRedirect("/ evil.com")).toBe("/");
		});

		it("rejects slash + null byte", () => {
			expect(getSafeRedirect("/\u0000evil.com")).toBe("/");
		});
	});

	describe("javascript: URLs", () => {
		it("rejects javascript:alert(1)", () => {
			expect(getSafeRedirect("javascript:alert(1)")).toBe("/");
		});

		it("rejects javascript: with allowedOrigins set", () => {
			expect(
				getSafeRedirect("javascript:alert(1)", {
					allowedOrigins: ["https://app.example.com"],
				}),
			).toBe("/");
		});
	});

	describe("data: URLs", () => {
		it("rejects data:text/html,...", () => {
			expect(getSafeRedirect("data:text/html,<script>alert(1)</script>")).toBe(
				"/",
			);
		});
	});

	describe("edge cases", () => {
		it("returns fallback for empty string", () => {
			expect(getSafeRedirect("")).toBe("/");
		});

		it("returns fallback for null", () => {
			expect(getSafeRedirect(null)).toBe("/");
		});

		it("returns fallback for undefined", () => {
			expect(getSafeRedirect(undefined)).toBe("/");
		});

		it("returns custom fallback for null", () => {
			expect(getSafeRedirect(null, { fallback: "/home" })).toBe("/home");
		});

		it("returns custom fallback for empty string", () => {
			expect(getSafeRedirect("", { fallback: "/home" })).toBe("/home");
		});

		it("returns fallback for whitespace-only string", () => {
			expect(getSafeRedirect("   ")).toBe("/");
		});

		it("trims leading whitespace before checking", () => {
			expect(getSafeRedirect("  /dashboard")).toBe("/dashboard");
		});

		it("returns fallback for non-URL string without leading slash", () => {
			expect(getSafeRedirect("dashboard")).toBe("/");
		});

		it("returns fallback for malformed URL", () => {
			expect(getSafeRedirect("https://[invalid")).toBe("/");
		});
	});
});
