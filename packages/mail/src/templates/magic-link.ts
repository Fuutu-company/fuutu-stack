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

export const magicLinkTemplate: TemplateRenderer<"magic-link"> = ({
	name,
	magicLinkUrl,
	locale,
}) => {
	const s = getMailStrings(locale);
	const t = s.magicLink;
	const greeting = s.greeting(name);

	const text = `${greeting}\n\n${t.intro}\n\n${magicLinkUrl}\n\n${t.ignore}\n\n${s.signature}`;

	const html = renderLayout(
		`
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(t.intro)}</p>
    <p style="margin:24px 0;">${renderButton(magicLinkUrl, t.button)}</p>
    <p style="color:${MAIL_COLORS.muted};font-size:13px;">${escapeHtml(t.orCopy)} <a href="${escapeAttr(safeHref(magicLinkUrl))}" style="color:${MAIL_COLORS.muted};">${escapeHtml(magicLinkUrl)}</a></p>
    <p style="color:${MAIL_COLORS.muted};font-size:13px;">${escapeHtml(t.ignore)}</p>
    <p style="margin-top:32px;color:${MAIL_COLORS.text};">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: t.intro },
	);

	return { subject: t.subject, text, html };
};
