/**
 * Email domain types — shared across templates and providers.
 */
export interface EmailMessage {
	from: string;
	to: string;
	subject: string;
	html: string;
	text: string;
	replyTo?: string;
}

/**
 * Any email provider must implement this contract.
 * Keeps sendEmail() agnostic of the underlying delivery mechanism.
 *
 * Naming note: the `Email*` / `email*` names shipped in v1.0.0 and are
 * public API — do not rename without a major version bump (AGENTS §3).
 */
export interface EmailProvider {
	readonly name: string;
	send(message: EmailMessage): Promise<void>;
}

/** Base payload fields every template accepts for i18n selection. */
interface BasePayload {
	/**
	 * Recipient locale — selects the translated strings (default: en).
	 * Any string is accepted: dormant locales resolve through the i18n
	 * fallback chain, unknown tags fall back to the default bundle.
	 */
	locale?: string;
}

/**
 * Strongly-typed template registry.
 * Each template key maps to the variables it expects.
 */
export interface TemplatePayloads {
	"password-reset": BasePayload & {
		name?: string;
		resetUrl: string;
	};
	"magic-link": BasePayload & {
		name?: string;
		magicLinkUrl: string;
	};
	"email-verification": BasePayload & {
		name?: string;
		verificationUrl: string;
	};
	"organization-invitation": BasePayload & {
		organizationName: string;
		inviteUrl: string;
		inviterName?: string;
	};
	"new-user": BasePayload & {
		name?: string;
		appUrl: string;
	};
	"email-change-verification": BasePayload & {
		name?: string;
		verificationUrl: string;
		newEmail: string;
	};
	notification: BasePayload & {
		name?: string;
		title: string;
		body: string;
		appUrl?: string;
	};
}

export type TemplateName = keyof TemplatePayloads;

export interface RenderedTemplate {
	subject: string;
	html: string;
	text: string;
}

/**
 * Template renderer — pure function, no side effects.
 */
export type TemplateRenderer<T extends TemplateName> = (
	data: TemplatePayloads[T],
) => RenderedTemplate;

/**
 * Supported provider identifiers. v1 active: plunk.
 * Skeletons kept for parity with env.EMAIL_PROVIDER enum (@fuutu/env/saas).
 */
export type ProviderName =
	| "console"
	| "noop"
	| "plunk"
	| "resend"
	| "nodemailer"
	| "postmark"
	| "mailgun";
