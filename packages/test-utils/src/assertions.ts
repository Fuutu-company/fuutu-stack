import { expect } from "vitest";

/** Asserts the value is a non-empty string. */
export function expectNonEmptyString(value: unknown): asserts value is string {
	expect(typeof value).toBe("string");
	expect((value as string).length).toBeGreaterThan(0);
}

/**
 * Asserts the promise resolves (does not reject).
 * Awaits the promise directly: a rejection propagates and fails the test.
 */
export async function expectResolves(
	promise: Promise<unknown> | (() => Promise<unknown>),
): Promise<void> {
	const fn = typeof promise === "function" ? promise : () => promise;
	await fn();
}

/** Asserts the promise rejects, optionally matching the error message substring. */
export async function expectRejects(
	promise: Promise<unknown> | (() => Promise<unknown>),
	messageContains?: string,
): Promise<void> {
	const fn = typeof promise === "function" ? promise : () => promise;
	if (messageContains) {
		await expect(fn()).rejects.toThrow(messageContains);
	} else {
		// Any rejection counts — including reject(undefined) where
		// `rejects.toBeDefined()` would false-negative.
		let didReject = false;
		await fn().then(
			() => {},
			() => {
				didReject = true;
			},
		);
		expect(didReject).toBe(true);
	}
}
