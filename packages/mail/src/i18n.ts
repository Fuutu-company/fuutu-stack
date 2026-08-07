/**
 * Mail-package-internal translations.
 *
 * Kept local to the package on purpose:
 *   - templates ship with the mail code and must be usable from any runtime
 *     (Node, edge workers, scripts) without loading app-level JSON bundles;
 *   - the mail surface is tiny and stable, so duplication cost is minimal;
 *   - adding a new locale here does not force a rebuild of every UI string
 *     bundle (and vice versa).
 *
 * To extend: add the locale key, keep the shape identical across all locales.
 */

import type { Locale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";

export interface MailStrings {
	signature: string;
	greeting: (name?: string) => string;
	passwordReset: {
		subject: string;
		intro: string;
		button: string;
		orCopy: string;
		ignore: string;
	};
	magicLink: {
		subject: string;
		intro: string;
		button: string;
		orCopy: string;
		ignore: string;
	};
	emailVerification: {
		subject: string;
		intro: string;
		button: string;
		orCopy: string;
		ignore: string;
	};
	organizationInvitation: {
		subject: (org: string) => string;
		headline: (inviter: string | undefined, org: string) => string;
		button: string;
		orCopy: string;
		ignore: string;
	};
	newUser: {
		subject: string;
		headline: string;
		intro: string;
		button: string;
		orCopy: string;
	};
	emailChangeVerification: {
		subject: string;
		intro: string;
		newEmailLabel: string;
		button: string;
		orCopy: string;
		ignore: string;
	};
	notification: {
		button: string;
		orCopy: string;
	};
}

const en: MailStrings = {
	signature: "— The Fuutu team",
	greeting: (name) => (name ? `Hi ${name},` : "Hi there,"),
	passwordReset: {
		subject: "Reset your password",
		intro:
			"We received a request to reset your password. Click the button below to choose a new one:",
		button: "Reset password",
		orCopy: "Or copy this link:",
		ignore:
			"If you didn't request this, you can safely ignore this email — your password will stay the same.",
	},
	magicLink: {
		subject: "Sign in to your account",
		intro: "Click the button below to sign in to your account:",
		button: "Sign in",
		orCopy: "Or copy this link:",
		ignore:
			"This link will expire shortly. If you didn't request it, you can ignore this email.",
	},
	emailVerification: {
		subject: "Verify your email address",
		intro: "Please verify your email address by clicking the button below:",
		button: "Verify email",
		orCopy: "Or copy this link:",
		ignore: "If you didn't create an account, you can ignore this email.",
	},
	organizationInvitation: {
		subject: (org) => `You've been invited to ${org}`,
		headline: (inviter, org) =>
			inviter
				? `${inviter} has invited you to join "${org}".`
				: `You have been invited to join "${org}".`,
		button: "Accept invitation",
		orCopy: "Or copy this link:",
		ignore:
			"If you don't recognize this invitation, you can safely ignore this email.",
	},
	newUser: {
		subject: "Welcome to Fuutu",
		headline: "Welcome aboard!",
		intro:
			"Your account is ready. Sign in to explore your dashboard and finish setting up your workspace.",
		button: "Open dashboard",
		orCopy: "Or copy this link:",
	},
	emailChangeVerification: {
		subject: "Confirm your new email address",
		intro:
			"Please confirm your new email address by clicking the button below:",
		newEmailLabel: "New email address:",
		button: "Confirm email change",
		orCopy: "Or copy this link:",
		ignore:
			"If you didn't request this change, you can safely ignore this email.",
	},
	notification: {
		button: "Open app",
		orCopy: "Or copy this link:",
	},
};

const de: MailStrings = {
	signature: "— Dein Fuutu-Team",
	greeting: (name) => (name ? `Hallo ${name},` : "Hallo,"),
	passwordReset: {
		subject: "Passwort zurücksetzen",
		intro:
			"Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke auf den Button unten, um ein neues Passwort zu wählen:",
		button: "Passwort zurücksetzen",
		orCopy: "Oder kopiere diesen Link:",
		ignore:
			"Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren — dein Passwort bleibt unverändert.",
	},
	magicLink: {
		subject: "Bei deinem Konto anmelden",
		intro: "Klicke auf den Button unten, um dich bei deinem Konto anzumelden:",
		button: "Anmelden",
		orCopy: "Oder kopiere diesen Link:",
		ignore:
			"Dieser Link läuft bald ab. Falls du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.",
	},
	emailVerification: {
		subject: "E-Mail-Adresse bestätigen",
		intro: "Bitte bestätige deine E-Mail-Adresse über den Button unten:",
		button: "E-Mail bestätigen",
		orCopy: "Oder kopiere diesen Link:",
		ignore:
			"Falls du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.",
	},
	organizationInvitation: {
		subject: (org) => `Du wurdest zu ${org} eingeladen`,
		headline: (inviter, org) =>
			inviter
				? `${inviter} hat dich eingeladen, „${org}" beizutreten.`
				: `Du wurdest eingeladen, „${org}" beizutreten.`,
		button: "Einladung annehmen",
		orCopy: "Oder kopiere diesen Link:",
		ignore:
			"Falls du diese Einladung nicht kennst, kannst du diese E-Mail ignorieren.",
	},
	newUser: {
		subject: "Willkommen bei Fuutu",
		headline: "Willkommen an Bord!",
		intro:
			"Dein Konto ist einsatzbereit. Melde dich an, um dein Dashboard zu erkunden und deinen Workspace einzurichten.",
		button: "Dashboard öffnen",
		orCopy: "Oder kopiere diesen Link:",
	},
	emailChangeVerification: {
		subject: "Bestätige deine neue E-Mail-Adresse",
		intro: "Bitte bestätige deine neue E-Mail-Adresse über den Button unten:",
		newEmailLabel: "Neue E-Mail-Adresse:",
		button: "E-Mail-Änderung bestätigen",
		orCopy: "Oder kopiere diesen Link:",
		ignore:
			"Falls du diese Änderung nicht angefordert hast, kannst du diese E-Mail ignorieren.",
	},
	notification: {
		button: "App öffnen",
		orCopy: "Oder kopiere diesen Link:",
	},
};

const bundles: Record<Locale, MailStrings> = { en, de };

/**
 * Resolve the mail string bundle for a given locale, honouring the i18n
 * fallback chain (e.g. de-AT → de → en) before defaulting to English.
 */
export function getMailStrings(locale?: Locale): MailStrings {
	if (!locale) return bundles[i18nConfig.defaultLocale as Locale] ?? en;
	const direct = bundles[locale];
	if (direct) return direct;
	const fallback = (
		i18nConfig.locales as Record<string, { fallbackLocale?: string }>
	)[locale]?.fallbackLocale as Locale | undefined;
	if (fallback && bundles[fallback]) return bundles[fallback];
	return en;
}
