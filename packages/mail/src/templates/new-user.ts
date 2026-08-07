import { getMailStrings } from "../i18n";
import type { TemplateRenderer } from "../types";
import { escapeAttr, escapeHtml, renderButton, renderLayout } from "./layout";

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
    <h1 style="margin:0 0 16px;font-size:22px;color:#111;">${escapeHtml(t.headline)}</h1>
    <p>${escapeHtml(t.intro)}</p>
    <p style="margin:24px 0;">${renderButton(appUrl, t.button)}</p>
    <p style="color:#6b7280;font-size:13px;">${escapeHtml(t.orCopy)} <a href="${escapeAttr(appUrl)}" style="color:#6b7280;">${escapeHtml(appUrl)}</a></p>
    <p style="margin-top:32px;color:#111;">${escapeHtml(s.signature)}</p>
    `,
		{ locale, previewText: t.headline },
	);

	return { subject: t.subject, text, html };
};
