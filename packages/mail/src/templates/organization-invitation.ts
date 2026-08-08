import { getMailStrings } from "../i18n";
import type { TemplateRenderer } from "../types";
import { escapeAttr, escapeHtml, renderButton, renderLayout } from "./layout";

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
    <p style="color:#6b7280;font-size:13px;">${escapeHtml(t.orCopy)} <a href="${escapeAttr(inviteUrl)}" style="color:#6b7280;">${escapeHtml(inviteUrl)}</a></p>
    <p style="color:#6b7280;font-size:13px;">${escapeHtml(t.ignore)}</p>
    <p style="margin-top:32px;color:#111;">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: headline },
	);

	return { subject: t.subject(organizationName), text, html };
};
