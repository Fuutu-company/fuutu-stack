import { getMailStrings } from "../i18n";
import type { TemplateRenderer } from "../types";
import { MAIL_COLORS } from "./colors";
import { escapeHtml, renderLayout, withLegalFooterText } from "./layout";

/** Sent to the previous address once an email change is complete. */
export const emailChangedTemplate: TemplateRenderer<"email-changed"> = ({
	name,
	newEmail,
	locale,
}) => {
	const s = getMailStrings(locale);
	const t = s.emailChanged;
	const greeting = s.greeting(name);

	const text = `${greeting}\n\n${t.intro}\n\n${t.newEmailLabel} ${newEmail}\n\n${t.notYou}\n\n${s.signature}`;

	const html = renderLayout(
		`
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(t.intro)}</p>
    <p style="margin:16px 0;color:${MAIL_COLORS.text};font-weight:600;">${escapeHtml(t.newEmailLabel)} ${escapeHtml(newEmail)}</p>
    <p>${escapeHtml(t.notYou)}</p>
    <p style="margin-top:32px;color:${MAIL_COLORS.text};">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: t.subject },
	);

	return {
		subject: t.subject,
		text: withLegalFooterText(text, locale),
		html,
	};
};
