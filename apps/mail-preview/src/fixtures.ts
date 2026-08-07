import type { Locale } from "@fuutu/i18n";
import {
	renderTemplate,
	type TemplateName,
	type TemplatePayloads,
} from "@fuutu/mail/templates";

/**
 * Sample payloads for every template — keep realistic but obviously fake
 * (no personal names, no live URLs) so that previews cannot be mistaken
 * for real mail.
 */
export const fixtures: { [K in TemplateName]: TemplatePayloads[K] } = {
	"password-reset": {
		name: "Ada",
		resetUrl: "https://example.test/auth/reset-password?token=preview-token",
	},
	"magic-link": {
		name: "Ada",
		magicLinkUrl: "https://example.test/auth/magic?token=preview-token",
	},
	"email-verification": {
		name: "Ada",
		verificationUrl: "https://example.test/auth/verify?token=preview-token",
	},
	"organization-invitation": {
		organizationName: "Acme Inc.",
		inviteUrl: "https://example.test/auth/accept-invitation?id=preview",
		inviterName: "Grace Hopper",
	},
	"new-user": {
		name: "Ada",
		appUrl: "https://example.test/dashboard",
	},
	"email-change-verification": {
		name: "Ada",
		verificationUrl:
			"https://example.test/auth/verify-email-change?token=preview-token",
		newEmail: "ada.new@example.test",
	},
	notification: {
		name: "Ada",
		title: "Subscription reminder",
		body: "Your trial subscription is ending soon.",
		appUrl: "https://example.test/dashboard",
	},
};

export const TEMPLATES: TemplateName[] = [
	"new-user",
	"email-verification",
	"email-change-verification",
	"magic-link",
	"password-reset",
	"organization-invitation",
	"notification",
];

export const LOCALES = ["en", "de"] as const;

/**
 * Type-safe helper: render a fixture for a given template + locale.
 * Avoids `as never` casts at every call site by constraining the lookup
 * inside a generic that ties the template key to its payload type.
 */
export function renderFixture<T extends TemplateName>(name: T, locale: Locale) {
	return renderTemplate(name, { ...fixtures[name], locale });
}
