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

import { getFallbackChain, type Locale } from "@fuutu/i18n";
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
	emailChanged: {
		subject: string;
		intro: string;
		newEmailLabel: string;
		notYou: string;
	};
	notification: {
		button: string;
		orCopy: string;
	};
}

// The "Fuutu" brand in signatures/subjects below is intentional — this is
// the kit's own demo branding, not a leaked product name. Rebrand by
// editing these bundles (same commit for every locale).
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
		subject: "Confirm your email change",
		intro:
			"We received a request to change your account's email address. Confirm it with the button below — we then send a verification link to the new address:",
		newEmailLabel: "New email address:",
		button: "Confirm email change",
		orCopy: "Or copy this link:",
		ignore:
			"If you didn't request this change, ignore this email and change your password — your email stays as it is.",
	},
	emailChanged: {
		subject: "Your email address was changed",
		intro:
			"The email address of your account was just changed. Sign-in links and notifications now go to the new address.",
		newEmailLabel: "New email address:",
		notYou:
			"If you didn't make this change, contact support right away — someone else may have access to your account.",
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
		subject: "Bestätige die Änderung deiner E-Mail-Adresse",
		intro:
			"Wir haben eine Anfrage erhalten, die E-Mail-Adresse deines Kontos zu ändern. Bestätige sie über den Button unten — danach schicken wir einen Bestätigungslink an die neue Adresse:",
		newEmailLabel: "Neue E-Mail-Adresse:",
		button: "E-Mail-Änderung bestätigen",
		orCopy: "Oder kopiere diesen Link:",
		ignore:
			"Falls du diese Änderung nicht angefordert hast, ignoriere diese E-Mail und ändere dein Passwort — deine E-Mail-Adresse bleibt unverändert.",
	},
	emailChanged: {
		subject: "Deine E-Mail-Adresse wurde geändert",
		intro:
			"Die E-Mail-Adresse deines Kontos wurde gerade geändert. Anmeldelinks und Benachrichtigungen gehen ab jetzt an die neue Adresse.",
		newEmailLabel: "Neue E-Mail-Adresse:",
		notYou:
			"Falls du das nicht warst, wende dich sofort an den Support — möglicherweise hat jemand anderes Zugriff auf dein Konto.",
	},
	notification: {
		button: "App öffnen",
		orCopy: "Oder kopiere diesen Link:",
	},
};

// `Record<Locale, …>` keeps a bundle mandatory for every enabled locale; the
// `Partial` intersection lets dormant bundles (e.g. `de` after it is removed
// from i18nConfig.locales) stay wired so re-enabling is config-only.
const bundles: Record<Locale, MailStrings> &
	Partial<Record<string, MailStrings>> = { en, de };

/**
 * Resolve the mail string bundle for a given locale via the shared i18n
 * fallback chain — exact match, then its configured `fallbackLocale`
 * (or the nearest configured BCP-47 parent when none is configured,
 * e.g. de-AT → de), then the default locale — returning the first
 * locale that has a mail bundle.
 */
export function getMailStrings(locale?: string): MailStrings {
	for (const loc of getFallbackChain(locale ?? i18nConfig.defaultLocale)) {
		const bundle = Object.hasOwn(bundles, loc) ? bundles[loc] : undefined;
		if (bundle) return bundle;
	}
	return en;
}
