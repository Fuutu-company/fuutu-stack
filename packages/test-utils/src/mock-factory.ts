/**
 * Type-safe partial mock factory.
 *
 * Returns a strongly-typed object that satisfies `T` for the keys you provide,
 * without forcing you to stub every field. Useful for building provider inputs
 * and SDK doubles in contract tests.
 *
 * ```ts
 * const msg = createMock<EmailMessage>({ from: "a@b", to: "c@d", subject: "x", html: "<p/>", text: "x" });
 * ```
 */
export function createMock<T>(partial: Partial<T>): T {
	return partial as T;
}
