/**
 * Server-side password policy enforcement.
 *
 * `authConfig.passwordPolicy` complexity rules (upper/lower/number/special)
 * are also checked client-side via `validatePassword` — but Better-Auth only
 * enforces min/max length, so direct `/api/auth/*` calls could bypass the
 * complexity rules. This guard runs in the global `hooks.before` middleware
 * for every endpoint that carries a plaintext password.
 */
import { APIError } from "better-auth/api";
import { validatePassword } from "../validate-password";

/** Better-Auth endpoints whose body contains a plaintext password. */
const PASSWORD_PATHS: ReadonlySet<string> = new Set([
	"/sign-up/email",
	"/change-password",
	"/reset-password",
	"/set-password",
	"/admin/create-user",
	"/admin/set-user-password",
]);

/**
 * Extracts the password under validation from a parsed request body.
 * `newPassword` wins over `password` (`/change-password` sends both).
 * Returns null when absent — schema validation reports missing fields.
 */
function extractPassword(body: unknown): string | null {
	if (typeof body !== "object" || body === null) return null;
	const { password, newPassword } = body as {
		password?: unknown;
		newPassword?: unknown;
	};
	if (typeof newPassword === "string") return newPassword;
	return typeof password === "string" ? password : null;
}

/**
 * Throws `APIError("BAD_REQUEST")` when a password-carrying endpoint
 * receives a password violating `authConfig.passwordPolicy`.
 */
export function assertPasswordPolicy(path: string, body: unknown): void {
	if (!PASSWORD_PATHS.has(path)) return;
	const password = extractPassword(body);
	if (password === null) return;
	if (validatePassword(password) !== null) {
		throw new APIError("BAD_REQUEST", {
			message: "Password does not meet the required complexity rules.",
		});
	}
}
