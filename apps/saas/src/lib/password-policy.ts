"use client";

import type { PasswordPolicyError } from "@fuutu/auth/validate-password";
import { useTranslations } from "next-intl";

/**
 * Resolve a structured password-policy error to a localized string,
 * using `auth.passwordPolicy.*` translation keys.
 */
export function usePasswordPolicyTranslator() {
	const t = useTranslations("auth.passwordPolicy");
	return (err: PasswordPolicyError): string => {
		if (err.kind === "tooShort") return t("tooShort", { min: err.min });
		return t(err.kind);
	};
}
