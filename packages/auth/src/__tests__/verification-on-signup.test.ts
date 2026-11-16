import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Invitations are listed and accepted only for a verified email, so every
 * sign-up must receive the verification mail — not only when
 * `requireEmailVerification` is on.
 */
describe("email verification on sign-up", () => {
	it("sends the verification mail on every sign-up", () => {
		const source = readFileSync(
			join(import.meta.dirname, "../index.ts"),
			"utf8",
		);
		expect(source).toMatch(/sendOnSignUp:\s*true/);
	});
});
