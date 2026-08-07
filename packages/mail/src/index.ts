export { resolveFromAddress, resolveProvider } from "./config";
export { emailConfig } from "./config/defaults";
export { getMailStrings, type MailStrings } from "./i18n";
export { consoleProvider } from "./providers/console";
export { mailgunProvider } from "./providers/mailgun";
export { nodemailerProvider } from "./providers/nodemailer";
export { noopProvider } from "./providers/noop";
export { plunkProvider } from "./providers/plunk";
export { postmarkProvider } from "./providers/postmark";
export { resendProvider } from "./providers/resend";
export { type SendEmailOptions, sendEmail } from "./send-email";
export { renderTemplate, templateRegistry } from "./templates";
export type {
	EmailMessage,
	EmailProvider,
	ProviderName,
	RenderedTemplate,
	TemplateName,
	TemplatePayloads,
	TemplateRenderer,
} from "./types";
