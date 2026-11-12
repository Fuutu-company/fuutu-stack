/**
 * Client-safe helpers for the TOTP two-factor flow (settings enrollment +
 * sign-in challenge at `/auth/two-factor`).
 */
import { getSafeRedirect } from "./redirect";

export const TWO_FACTOR_PATH = "/auth/two-factor";

export type TwoFactorErrorKey = "invalidCode" | "expired" | "locked" | "failed";

/** The base32 setup key from an `otpauth://` URI, for manual entry. */
export function getTotpSecret(totpURI: string): string | null {
	try {
		return new URL(totpURI).searchParams.get("secret");
	} catch {
		return null;
	}
}

/**
 * True when a credential sign-in was accepted but Better Auth's two-factor
 * hook withheld the session pending a second factor.
 */
export function isTwoFactorRedirect(data: unknown): boolean {
	return (
		typeof data === "object" &&
		data !== null &&
		"twoFactorRedirect" in data &&
		data.twoFactorRedirect === true
	);
}

/** Verification page URL carrying the sanitized post-sign-in target. */
export function getTwoFactorPath(
	redirectTo: string | null | undefined,
): string {
	return `${TWO_FACTOR_PATH}?redirect=${encodeURIComponent(getSafeRedirect(redirectTo))}`;
}

/** Maps Better Auth two-factor error codes to `auth.twoFactor.errors.*`. */
export function getTwoFactorErrorKey(
	code: string | undefined,
): TwoFactorErrorKey {
	switch (code) {
		case "INVALID_CODE":
		case "INVALID_BACKUP_CODE":
			return "invalidCode";
		case "INVALID_TWO_FACTOR_COOKIE":
		case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
			return "expired";
		case "ACCOUNT_TEMPORARILY_LOCKED":
			return "locked";
		default:
			return "failed";
	}
}
