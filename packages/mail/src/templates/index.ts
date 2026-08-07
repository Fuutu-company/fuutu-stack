import type {
	RenderedTemplate,
	TemplateName,
	TemplatePayloads,
} from "../types";
import { emailChangeVerificationTemplate } from "./email-change-verification";
import { emailVerificationTemplate } from "./email-verification";
import { magicLinkTemplate } from "./magic-link";
import { newUserTemplate } from "./new-user";
import { notificationTemplate } from "./notification";
import { organizationInvitationTemplate } from "./organization-invitation";
import { passwordResetTemplate } from "./password-reset";

/**
 * Template registry — renderer lookup by name.
 * Using `unknown` in the value position because each renderer has a
 * different payload; the public renderTemplate() function below adds
 * type-safe access.
 */
const registry = {
	"password-reset": passwordResetTemplate,
	"magic-link": magicLinkTemplate,
	"email-verification": emailVerificationTemplate,
	"email-change-verification": emailChangeVerificationTemplate,
	"organization-invitation": organizationInvitationTemplate,
	"new-user": newUserTemplate,
	notification: notificationTemplate,
} as const;

export function renderTemplate<T extends TemplateName>(
	template: T,
	data: TemplatePayloads[T],
): RenderedTemplate {
	const renderer = registry[template] as (
		d: TemplatePayloads[T],
	) => RenderedTemplate;
	return renderer(data);
}

export type { RenderedTemplate, TemplateName, TemplatePayloads };
export { registry as templateRegistry };
