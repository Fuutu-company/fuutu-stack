/**
 * Auth-side email adapter.
 *
 * Delegates to @fuutu/mail, which handles provider selection
 * (console / noop / resend) and template rendering.
 *
 * Kept as a thin wrapper so Better Auth config does not change
 * when providers are swapped.
 */
import {
	sendEmail as send,
	type TemplateName,
	type TemplatePayloads,
} from "@fuutu/mail";

interface EmailOptions<T extends TemplateName> {
	to: string;
	subject?: string;
	template: T;
	data: TemplatePayloads[T];
}

export async function sendEmail<T extends TemplateName>({
	to,
	subject,
	template,
	data,
}: EmailOptions<T>): Promise<void> {
	await send({ to, subject, template, data });
}
