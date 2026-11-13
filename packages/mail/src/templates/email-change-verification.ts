import { getMailStrings } from "../i18n";
import type { TemplateRenderer } from "../types";
import { MAIL_COLORS } from "./colors";
import {
	escapeAttr,
	escapeHtml,
	renderButton,
	renderLayout,
	safeHref,
} from "./layout";

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
    <p style="margin:16px 0;color:${MAIL_COLORS.text};font-weight:600;">${escapeHtml(t.newEmailLabel)} ${escapeHtml(newEmail)}</p>
    <p style="margin:24px 0;">${renderButton(verificationUrl, t.button)}</p>
    <p style="color:${MAIL_COLORS.muted};font-size:13px;">${escapeHtml(t.orCopy)} <a href="${escapeAttr(safeHref(verificationUrl))}" style="color:${MAIL_COLORS.muted};">${escapeHtml(verificationUrl)}</a></p>
    <p style="color:${MAIL_COLORS.muted};font-size:13px;">${escapeHtml(t.ignore)}</p>
    <p style="margin-top:32px;color:${MAIL_COLORS.text};">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: t.subject },
	);

	return { subject: t.subject, text, html };
};
