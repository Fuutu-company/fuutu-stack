/**
 * Type-safe partial mock factory.
 *
 * Casts the partial to `T` — only the provided keys exist at runtime, so
 * treat the result as a test double, not a real `T`. Useful for building
 * provider inputs and SDK doubles in contract tests.
 *
 * ```ts
 * const msg = createMock<EmailMessage>({ from: "a@b", to: "c@d", subject: "x", html: "<p/>", text: "x" });
 * ```
 */
export function createMock<T>(partial: Partial<T>): T {
	return partial as T;
}
