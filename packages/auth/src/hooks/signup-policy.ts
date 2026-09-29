/**
 * Self-service sign-up gate driven by `authConfig.signup`.
 *
 * Runs in `databaseHooks.user.create.before` (alongside the invitation-only
 * gate) so every self-registration path is covered — email/password,
 * social `/callback/*`, and magic-link `/magic-link/verify` auto-sign-up.
 *
 * Scoped to self-service endpoint paths: admin provisioning
 * (`/admin/create-user`) and context-free creations (seed/CLI scripts)
 * are unaffected. `emailAndPassword.disableSignUp` and the magicLink
 * plugin's `disableSignUp` short-circuit earlier for nicer client errors;
 * this hook is the uniform backstop, including the domain allow-list.
 */
import { APIError } from "better-auth/api";
import { authConfig } from "../config";

export interface SignupPolicy {
	enabled: boolean;
	allowedDomains: readonly string[];
}

const SELF_SERVICE_SIGNUP_PATHS: ReadonlySet<string> = new Set([
	"/sign-up/email",
	"/magic-link/verify",
]);

/** `/callback/<provider>` covers every social provider callback. */
function isSelfServiceSignupPath(path: string | undefined): boolean {
	if (!path) return false;
	return SELF_SERVICE_SIGNUP_PATHS.has(path) || path.startsWith("/callback/");
}

/**
 * Throws `APIError("FORBIDDEN")` when a self-service user creation is not
 * permitted by `authConfig.signup` (sign-up disabled or email domain not
 * in `allowedDomains`).
 */
export function assertSignupPolicy(
	user: { email?: string | null },
	context?: { path?: string } | null,
	signup: SignupPolicy = authConfig.signup,
): void {
	if (!isSelfServiceSignupPath(context?.path)) return;

	if (!signup.enabled) {
		throw new APIError("FORBIDDEN", {
			message: "Sign-up is disabled.",
		});
	}

	if (signup.allowedDomains.length === 0) return;
	const domain = user.email?.split("@").at(-1)?.toLowerCase();
	if (
		!domain ||
		!signup.allowedDomains
			.map((allowed) => allowed.toLowerCase())
			.includes(domain)
	) {
		throw new APIError("FORBIDDEN", {
			message: "Sign-up is not allowed for this email domain.",
		});
	}
}
