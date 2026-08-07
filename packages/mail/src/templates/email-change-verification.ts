import { getMailStrings } from "../i18n";
import type { TemplateRenderer } from "../types";
import { escapeAttr, escapeHtml, renderButton, renderLayout } from "./layout";

export const emailChangeVerificationTemplate: TemplateRenderer<
	"email-change-verification"
> = ({ name, newEmail, verificationUrl, locale }) => {
	const s = getMailStrings(locale);
	const t = s.emailChangeVerification;
	const greeting = s.greeting(name);

	const text = `${greeting}\n\n${t.intro}\n\n${t.newEmailLabel} ${newEmail}\n\n${verificationUrl}\n\n${t.ignore}\n\n${s.signature}`;

	const html = renderLayout(
		`
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(t.intro)}</p>
    <p style="margin:16px 0;color:#111;font-weight:600;">${escapeHtml(t.newEmailLabel)} ${escapeHtml(newEmail)}</p>
    <p style="margin:24px 0;">${renderButton(verificationUrl, t.button)}</p>
    <p style="color:#6b7280;font-size:13px;">${escapeHtml(t.orCopy)} <a href="${escapeAttr(verificationUrl)}" style="color:#6b7280;">${escapeHtml(verificationUrl)}</a></p>
    <p style="color:#6b7280;font-size:13px;">${escapeHtml(t.ignore)}</p>
    <p style="margin-top:32px;color:#111;">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: t.subject },
	);

	return { subject: t.subject, text, html };
};
