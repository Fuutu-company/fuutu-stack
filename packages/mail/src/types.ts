/**
 * Email domain types — shared across templates and providers.
 */
import type { Locale } from "@fuutu/i18n";

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
 */
export interface EmailProvider {
	readonly name: string;
	send(message: EmailMessage): Promise<void>;
}

/** Base payload fields every template accepts for i18n selection. */
interface BasePayload {
	/** Recipient locale — selects the translated strings (default: en). */
	locale?: Locale;
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
