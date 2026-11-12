import { describe, expect, it } from "vitest";
import { API_KEY_HEADER } from "../context";
import { CORS_ALLOW_HEADERS } from "../cors";

describe("CORS allow-list", () => {
	it("allows every header the API authenticates with", () => {
		const allowed = CORS_ALLOW_HEADERS.map((h) => h.toLowerCase());
		expect(allowed).toContain("authorization");
		expect(allowed).toContain(API_KEY_HEADER.toLowerCase());
		expect(allowed).toContain("content-type");
	});
});
