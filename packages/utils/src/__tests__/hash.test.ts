import { describe, expect, it } from "vitest";
import { hash, sha256 } from "../hash";

describe("hash (FNV-1a 32-bit)", () => {
	it("returns known value for empty string", () => {
		expect(hash("")).toBe("811c9dc5");
	});

	it("is deterministic — same input produces same output", () => {
		expect(hash("hello")).toBe(hash("hello"));
	});

	it("produces an 8-char hex string", () => {
		expect(hash("hello")).toMatch(/^[0-9a-f]{8}$/);
	});

	it("different inputs produce different hashes", () => {
		expect(hash("hello")).not.toBe(hash("world"));
		expect(hash("a")).not.toBe(hash("b"));
	});

	it("handles unicode input", () => {
		const result = hash("héllo");
		expect(result).toMatch(/^[0-9a-f]{8}$/);
		expect(result).toBe(hash("héllo"));
	});

	it("handles long strings", () => {
		const result = hash("a".repeat(1000));
		expect(result).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe("sha256 (Web Crypto)", () => {
	it("returns known value for empty string", async () => {
		expect(await sha256("")).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
	});

	it("returns known value for 'hello'", async () => {
		expect(await sha256("hello")).toBe(
			"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		);
	});

	it("is deterministic — same input produces same output", async () => {
		expect(await sha256("test")).toBe(await sha256("test"));
	});

	it("produces a 64-char hex string", async () => {
		expect(await sha256("anything")).toMatch(/^[0-9a-f]{64}$/);
	});

	it("different inputs produce different hashes", async () => {
		expect(await sha256("hello")).not.toBe(await sha256("world"));
	});

	it("handles unicode input", async () => {
		const result = await sha256("héllo");
		expect(result).toMatch(/^[0-9a-f]{64}$/);
		expect(result).toBe(await sha256("héllo"));
	});
});
