import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * `appSlots.headerActions` — app UI in the desktop top bar, right before
 * the notification bell. `AppHeader` is a client component, so the server
 * `DashboardLayout` renders the slot and hands the element down as the
 * `actions` prop — only when the app set it, so an unset slot leaves the
 * header markup and its RSC props exactly as before.
 */

const SAAS = join(import.meta.dirname, "../../../../apps/saas");
const COMPONENTS = join(SAAS, "src/modules/app/components");

type Element = { type: unknown; props: Record<string, unknown> };
const h = vi.hoisted(() => {
	const { createRequire } =
		require("node:module") as typeof import("node:module");
	const { join } = require("node:path") as typeof import("node:path");
	const saas = join(__dirname, "../../../../apps/saas/package.json");
	const react = createRequire(saas)("react") as {
		createElement: (
			type: unknown,
			props: unknown,
			...children: unknown[]
		) => unknown;
	};
	const tag =
		(name: string) =>
		({ children }: { children?: unknown }) =>
			react.createElement(name, null, children);
	// The header's bare imports resolve from the app, not from this package.
	const dep = (name: string) =>
		join(__dirname, "../../../../apps/saas/node_modules", name);
	return { createElement: react.createElement, tag, dep };
});

vi.mock(h.dep("next/navigation.js"), () => ({
	usePathname: () => "/dashboard",
	useSearchParams: () => new URLSearchParams(),
}));
vi.mock(h.dep("next-intl"), () => ({
	useTranslations: () => (key: string) => key,
}));
vi.mock(h.dep("next/link.js"), () => ({
	default: ({ href, children }: { href: string; children?: unknown }) =>
		h.createElement("a", { href }, children),
}));
vi.mock(h.dep("@fuutu/ui"), () => ({
	Breadcrumb: h.tag("nav"),
	BreadcrumbList: h.tag("ol"),
	BreadcrumbItem: h.tag("li"),
	BreadcrumbLink: h.tag("span"),
	BreadcrumbPage: h.tag("span"),
	BreadcrumbSeparator: h.tag("hr"),
	Separator: () => h.createElement("hr", null),
	SidebarTrigger: () => h.createElement("button", null),
}));
vi.mock("@shared/components/locale-switcher", () => ({
	LocaleSwitcher: () => h.createElement("i", { id: "locale" }),
}));
vi.mock("@/modules/app/notifications/components/notification-bell", () => ({
	NotificationBell: () => h.createElement("i", { id: "bell" }),
}));
vi.mock(
	"../../../../apps/saas/src/modules/app/components/theme-toggle",
	() => ({
		ThemeToggle: () => h.createElement("i", { id: "theme" }),
	}),
);
vi.mock("../../../../apps/saas/src/modules/app/components/breadcrumbs", () => ({
	buildBreadcrumbs: () => [{ labelKey: "breadcrumb.dashboard" }],
}));

const requireFromSaas = createRequire(join(SAAS, "package.json"));
const { renderToStaticMarkup } = requireFromSaas("react-dom/server") as {
	renderToStaticMarkup: (element: unknown) => string;
};
// Non-literal path: the header is `.tsx` this package's tsc must not follow.
const { AppHeader } = (await import(
	/* @vite-ignore */ join(COMPONENTS, "app-header.tsx")
)) as { AppHeader: (props: { actions?: unknown }) => Element };

const render = (props: { actions?: unknown }) =>
	renderToStaticMarkup(h.createElement(AppHeader, props));

const KIT_HEADER =
	'<header class="hidden h-14 shrink-0 items-center gap-2 bg-transparent px-4 md:flex md:px-8">' +
	"<button></button><hr/>" +
	"<nav><ol><li><span>breadcrumb.dashboard</span></li></ol></nav>" +
	'<div class="ml-auto flex items-center gap-1">' +
	'<i id="bell"></i><i id="locale"></i><i id="theme"></i>' +
	"</div></header>";

describe("AppHeader actions", () => {
	it("renders the kit header unchanged without actions", () => {
		expect(render({})).toBe(KIT_HEADER);
	});

	it("renders the app actions right before the notification bell", () => {
		const actions = h.createElement("b", { id: "app" }, "app");
		expect(render({ actions })).toBe(
			KIT_HEADER.replace('<i id="bell">', '<b id="app">app</b><i id="bell">'),
		);
	});
});

describe("DashboardLayout", () => {
	const layout = readFileSync(
		join(SAAS, "src/modules/app/layouts/dashboard-layout.tsx"),
		"utf8",
	);

	it("renders the headerActions slot on the server through renderSlot", () => {
		expect(layout).toMatch(
			/=\s*renderSlot\(\s*appSlots\.headerActions,\s*\{\}\s*\)/,
		);
	});

	it("passes actions to AppHeader only when the app set the slot", () => {
		expect(layout).toMatch(
			/\{headerActions \?\s*\(?\s*<AppHeader actions=\{headerActions\} \/>\s*\)?\s*:\s*\(?\s*<AppHeader \/>\s*\)?\s*\}/,
		);
		expect(layout.match(/<AppHeader\b/g)).toHaveLength(2);
	});
});
