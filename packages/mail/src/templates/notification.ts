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

/**
 * Generic notification email — renders an arbitrary title/body pair.
 *
 * Used by `@fuutu/notifications` email channel for any notification type that
 * does not have a dedicated template (billing, system, org, …). The subject
 * is provided by the caller via `sendEmail({ subject })`.
 */
export const notificationTemplate: TemplateRenderer<"notification"> = ({
	name,
	title,
	body,
	appUrl,
	locale,
}) => {
	const s = getMailStrings(locale);
	const t = s.notification;
	const greeting = s.greeting(name);

	const text = `${greeting}\n\n${title}\n\n${body}${appUrl ? `\n\n${appUrl}` : ""}\n\n${s.signature}`;

	const cta = appUrl
		? `<p style="margin:24px 0;">${renderButton(appUrl, t.button)}</p><p style="color:${MAIL_COLORS.muted};font-size:13px;">${escapeHtml(t.orCopy)} <a href="${escapeAttr(safeHref(appUrl))}" style="color:${MAIL_COLORS.muted};">${escapeHtml(appUrl)}</a></p>`
		: "";

	const html = renderLayout(
		`
    <p>${escapeHtml(greeting)}</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:${MAIL_COLORS.text};">${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    ${cta}
    <p style="margin-top:32px;color:${MAIL_COLORS.text};">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: title },
	);

	return { subject: title, text, html };
};
