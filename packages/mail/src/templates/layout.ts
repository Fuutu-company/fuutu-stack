/**
 * Minimal email HTML scaffold.
 *
 * A shared layout keeps every Fuutu transactional email visually consistent
 * and lets us tweak the frame (brand colour, footer, locale direction) in
 * one place instead of in every template file.
 *
 * Intentionally inline-styled: mail clients strip <style> tags aggressively.
 * No external CSS, no webfonts.
 */
import { getDirection, type Locale } from "@fuutu/i18n";

export interface LayoutOptions {
	locale?: Locale;
	previewText?: string;
}

export function renderLayout(body: string, opts: LayoutOptions = {}): string {
	const direction = opts.locale ? getDirection(opts.locale) : "ltr";
	const preview = opts.previewText
		? `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escapeHtml(opts.previewText)}</div>`
		: "";
	return `<!doctype html>
<html lang="${opts.locale ?? "en"}" dir="${direction}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Fuutu</title>
  </head>
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#111;">
    ${preview}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:32px;">
          ${body}
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

/**
 * Inline-styled CTA button that renders reliably across Gmail, Outlook,
 * Apple Mail. Uses a table fallback-free approach — enough for dev.
 */
export function renderButton(href: string, label: string): string {
	return `<a href="${escapeAttr(href)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a>`;
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function escapeAttr(s: string): string {
	return escapeHtml(s).replace(/'/g, "&#39;");
}
