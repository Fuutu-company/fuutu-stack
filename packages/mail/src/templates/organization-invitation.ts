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

export const organizationInvitationTemplate: TemplateRenderer<
	"organization-invitation"
> = ({ organizationName, inviteUrl, inviterName, locale }) => {
	const s = getMailStrings(locale);
	const t = s.organizationInvitation;
	const headline = t.headline(inviterName, organizationName);

	const text = `${headline}\n\n${inviteUrl}\n\n${t.ignore}\n\n${s.signature}`;

	const html = renderLayout(
		`
    <p><strong>${escapeHtml(headline)}</strong></p>
    <p style="margin:24px 0;">${renderButton(inviteUrl, t.button)}</p>
    <p style="color:${MAIL_COLORS.muted};font-size:13px;">${escapeHtml(t.orCopy)} <a href="${escapeAttr(safeHref(inviteUrl))}" style="color:${MAIL_COLORS.muted};">${escapeHtml(inviteUrl)}</a></p>
    <p style="color:${MAIL_COLORS.muted};font-size:13px;">${escapeHtml(t.ignore)}</p>
    <p style="margin-top:32px;color:${MAIL_COLORS.text};">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: headline },
	);

	return { subject: t.subject(organizationName), text, html };
};
