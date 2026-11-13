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
 * Welcome email sent once a user's account is verified/created.
 *
 * Sent from the Better-Auth `user.create` after-hook. Keeps
 * the surface small on purpose — onboarding content belongs in the app
 * shell, not in the inbox.
 */
export const newUserTemplate: TemplateRenderer<"new-user"> = ({
	name,
	appUrl,
	locale,
}) => {
	const s = getMailStrings(locale);
	const t = s.newUser;
	const greeting = s.greeting(name);

	const text = `${greeting}\n\n${t.headline}\n\n${t.intro}\n\n${appUrl}\n\n${s.signature}`;

	const html = renderLayout(
		`
    <p>${escapeHtml(greeting)}</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:${MAIL_COLORS.text};">${escapeHtml(t.headline)}</h1>
    <p>${escapeHtml(t.intro)}</p>
    <p style="margin:24px 0;">${renderButton(appUrl, t.button)}</p>
    <p style="color:${MAIL_COLORS.muted};font-size:13px;">${escapeHtml(t.orCopy)} <a href="${escapeAttr(safeHref(appUrl))}" style="color:${MAIL_COLORS.muted};">${escapeHtml(appUrl)}</a></p>
    <p style="margin-top:32px;color:${MAIL_COLORS.text};">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: t.headline },
	);

	return { subject: t.subject, text, html };
};
