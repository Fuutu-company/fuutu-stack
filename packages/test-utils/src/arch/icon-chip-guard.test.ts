import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test (DESIGN.md, Iconography): icons stand on their own — plain
 * Lucide strokes in a text role or an area ink, never on a round or filled
 * chip. Flags a fixed-size, centered box with a radius and a fill — the
 * shape of an icon chip. Avatars (initials, org logos), counters and
 * buttons share that shape; they are listed below with the reason.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const SCAN_DIRS = [
	"apps/saas/src",
	"apps/marketing/src",
	"apps/docs/src",
	"packages/ui/src",
];

/** A square box (size-N or aspect-square) … */
const SQUARE = /\b(size-(\d+(\.\d+)?|\[[^\]]+\])|aspect-square)\b/;
/** … centering its content … */
const CENTERED = /\b(justify-center|place-items-center|place-content-center)\b/;
/** … with a radius … */
const ROUNDED = /\brounded(-(sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?\b/;
/** … and a fill. */
const FILLED = /(?<![\w:-])bg-(?!clip|transparent|none\b)[\w/[\].-]+/;

/** `file:line` hits that are not icon chips, with the reason. */
const ALLOWED: Record<string, string> = {
	"apps/saas/src/modules/app/components/org-switcher.tsx":
		"organization avatar: logo or initial in the brand tile",
	"apps/saas/src/modules/app/chat/components/chat-message-list.tsx":
		"chat avatar with the assistant's initial",
	"apps/saas/src/modules/app/chat/components/chat-message-bubble.tsx":
		"chat avatar with initials",
	"apps/saas/src/modules/app/design-system/components/design-header.tsx":
		"numbered step marker (text, not an icon)",
	"apps/saas/src/modules/app/onboarding/onboarding-wizard.tsx":
		"step counter (text, not an icon)",
	"apps/marketing/src/modules/marketing/home/components/feature-bento.tsx":
		"member avatars with initials in the product mock",
	"packages/ui/src/components/logo-rail/logo-item.tsx":
		"third-party logo tiles (logos, not icons)",
	"packages/ui/src/components/media-frame/expandable.tsx":
		"icon button over a screenshot: the fill keeps it readable on any image",
	"packages/ui/src/components/sidebar.tsx": "menu badge (counter text)",
	"packages/ui/src/components/media-frame/video.tsx":
		"play button over a video: the fill keeps it readable on any frame",
	"apps/saas/src/modules/app/notifications/components/notification-bell.tsx":
		"unread counter on the bell (text, not an icon)",
	"apps/saas/src/modules/app/organizations/components/org-logo-upload.tsx":
		"organization logo preview (an image frame)",
	"apps/saas/src/modules/auth/components/auth-sign-up.tsx":
		"'last used' marker on the corner of a provider button",
	"packages/ui/src/components/avatar.tsx": "avatar",
	"packages/ui/src/components/checkbox.tsx": "checkbox control",
	"packages/ui/src/components/radio-group.tsx": "radio control",
	"packages/ui/src/components/switch.tsx": "switch control",
	"packages/ui/src/components/slider.tsx": "slider thumb",
	"packages/ui/src/components/button.tsx": "button",
	"packages/ui/src/components/dialog.tsx": "dialog close button",
	"packages/ui/src/components/sheet.tsx": "sheet close button",
};

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === "__tests__" || name === "node_modules" || name === ".next") {
			continue;
		}
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.tsx$/.test(name)) out.push(full);
	}
	return out;
}

/** Every class string literal of a file ("…" inside className or cn()). */
function classStrings(source: string): { text: string; line: number }[] {
	const out: { text: string; line: number }[] = [];
	const pattern = /"([^"\n]*)"/g;
	for (const match of source.matchAll(pattern)) {
		const text = match[1] ?? "";
		if (!/\b(flex|grid|inline-flex|inline-grid|block)\b/.test(text)) continue;
		const line = source.slice(0, match.index).split("\n").length;
		out.push({ text, line });
	}
	return out;
}

function iconChips(): string[] {
	const hits: string[] = [];
	for (const dir of SCAN_DIRS) {
		for (const file of walk(join(REPO_ROOT, dir))) {
			const rel = relative(REPO_ROOT, file);
			if (Object.hasOwn(ALLOWED, rel)) continue;
			for (const { text, line } of classStrings(readFileSync(file, "utf8"))) {
				if (
					SQUARE.test(text) &&
					CENTERED.test(text) &&
					ROUNDED.test(text) &&
					FILLED.test(text)
				)
					hits.push(`${rel}:${line}`);
			}
		}
	}
	return hits;
}

describe("icon chip guard", () => {
	it("draws no icon on a round or filled chip", () => {
		expect(
			iconChips(),
			"Icons are plain (DESIGN.md Iconography): drop the fill and the radius, colour the icon with a text role or an area ink. A real avatar, counter or control goes in ALLOWED with the reason.",
		).toEqual([]);
	});

	it("lists only files that still exist", () => {
		for (const file of Object.keys(ALLOWED))
			expect(statSync(join(REPO_ROOT, file)).isFile(), file).toBe(true);
	});
});
