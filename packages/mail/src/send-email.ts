import { resolveFromAddress, resolveProvider } from "./config";
import { renderTemplate } from "./templates";
import type { TemplateName, TemplatePayloads } from "./types";

export interface SendEmailOptions<T extends TemplateName> {
	to: string;
	template: T;
	data: TemplatePayloads[T];
	/** Optional override for the template's default subject */
	subject?: string;
	/** Optional reply-to header */
	replyTo?: string;
	/** Optional override for the From address (otherwise config/env default) */
	from?: string;
}

/**
 * Send an email using the configured provider and a typed template.
 *
 * The provider selection happens per-call so EMAIL_PROVIDER can be changed
 * at runtime (useful for tests).
 */
export async function sendEmail<T extends TemplateName>(
	options: SendEmailOptions<T>,
): Promise<void> {
	const provider = resolveProvider();
	const rendered = renderTemplate(options.template, options.data);

	await provider.send({
		from: options.from ?? resolveFromAddress(),
		to: options.to,
		subject: options.subject ?? rendered.subject,
		html: rendered.html,
		text: rendered.text,
		replyTo: options.replyTo,
	});
}
