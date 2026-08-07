import { authConfig } from "./config";

export type PasswordPolicyError =
	| { kind: "tooShort"; min: number }
	| { kind: "needsUpper" }
	| { kind: "needsLower" }
	| { kind: "needsNumber" }
	| { kind: "needsSpecial" };

/**
 * Validate a password against `authConfig.passwordPolicy`.
 *
 * Returns the first violation as a structured error so the calling layer
 * can resolve it to a localized string (`auth.passwordPolicy.*`).
 */
export function validatePassword(value: string): PasswordPolicyError | null {
	const p = authConfig.passwordPolicy;
	if (value.length < p.minLength) return { kind: "tooShort", min: p.minLength };
	if (p.requireUppercase && !/[A-Z]/.test(value)) return { kind: "needsUpper" };
	if (p.requireLowercase && !/[a-z]/.test(value)) return { kind: "needsLower" };
	if (p.requireNumbers && !/\d/.test(value)) return { kind: "needsNumber" };
	if (p.requireSpecialChars && !/[^A-Za-z0-9]/.test(value))
		return { kind: "needsSpecial" };
	return null;
}
