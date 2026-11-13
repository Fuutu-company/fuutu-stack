import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	AREAS,
	AreaBackdrop,
	AreaBadge,
	AreaIcon,
	AreaTile,
} from "../components/area";
import { PageHeader } from "../components/page-header";

function classesOf(html: string, slot: string): string[] {
	const match = html.match(
		new RegExp(`<[^>]*data-slot="${slot}"[^>]*class="([^"]*)"`),
	);
	const reversed = html.match(
		new RegExp(`<[^>]*class="([^"]*)"[^>]*data-slot="${slot}"`),
	);
	return (match?.[1] ?? reversed?.[1] ?? "").split(/\s+/).filter(Boolean);
}

describe("AREAS", () => {
	it("AREAS is users, billing, ai, api", () => {
		expect([...AREAS]).toEqual(["users", "billing", "ai", "api"]);
	});
});

describe("AreaTile", () => {
	it("renders data-area and bg-area-<a> + text-area-<a>-foreground for every area", () => {
		const expected = {
			users: ["bg-area-users", "text-area-users-foreground"],
			billing: ["bg-area-billing", "text-area-billing-foreground"],
			ai: ["bg-area-ai", "text-area-ai-foreground"],
			api: ["bg-area-api", "text-area-api-foreground"],
		};
		for (const area of AREAS) {
			const html = renderToString(
				createElement(AreaTile, { area, title: "Members", value: "12" }),
			);
			expect(html).toContain(`data-area="${area}"`);
			const classes = classesOf(html, "area-tile");
			expect(classes).toEqual(expect.arrayContaining(expected[area]));
			for (const other of AREAS.filter((a) => a !== area)) {
				expect(classes).not.toContain(`bg-area-${other}`);
			}
			expect(html).toContain(">Members<");
			expect(html).toContain(">12<");
		}
	});

	it("renders the description and children when given", () => {
		const html = renderToString(
			createElement(
				AreaTile,
				{ area: "ai", title: "Credits", value: "500", description: "Left" },
				createElement("span", { "data-testid": "extra" }, "x"),
			),
		);
		expect(html).toContain(">Left<");
		expect(html).toContain('data-testid="extra"');
	});
});

describe("AreaTile aligned", () => {
	it("pins value and caption to one line each; the caption keeps its full text in title", () => {
		const html = renderToString(
			createElement(AreaTile, {
				area: "billing",
				title: "Billing",
				value: "Free",
				description: "Billing lives on your organizations",
				aligned: true,
			}),
		);
		expect(classesOf(html, "area-tile-value")).toEqual(
			expect.arrayContaining(["h-10", "leading-10", "truncate"]),
		);
		expect(classesOf(html, "area-tile-caption")).toEqual(
			expect.arrayContaining(["h-5", "leading-5", "truncate"]),
		);
		expect(html).toMatch(
			/data-slot="area-tile-caption"[^>]*title="Billing lives on your organizations"/,
		);
	});

	it("reserves the caption row when there is no caption, so values stay level", () => {
		const html = renderToString(
			createElement(AreaTile, {
				area: "api",
				title: "API keys",
				value: "No access",
				aligned: true,
			}),
		);
		expect(html).toMatch(/<span aria-hidden="true" class="[^"]*\bh-5\b/);
		expect(html).not.toContain('data-slot="area-tile-caption"');
	});

	it("leaves the default tile free to wrap", () => {
		const html = renderToString(
			createElement(AreaTile, {
				area: "ai",
				title: "Credits",
				value: "500",
				description: "Left",
			}),
		);
		expect(classesOf(html, "area-tile-caption")).not.toContain("truncate");
		expect(html).not.toContain("title=");
	});
});

describe("AreaIcon, AreaBadge, AreaBackdrop", () => {
	it("AreaIcon is hidden from assistive tech and sized by prop", () => {
		const sm = renderToString(
			createElement(AreaIcon, { area: "api", size: "sm" }, "i"),
		);
		const md = renderToString(createElement(AreaIcon, { area: "api" }, "i"));
		expect(sm).toContain('aria-hidden="true"');
		expect(classesOf(sm, "area-icon")).toEqual(
			expect.arrayContaining([
				"size-6",
				"bg-area-api",
				"text-area-api-foreground",
			]),
		);
		expect(classesOf(md, "area-icon")).toContain("size-9");
	});

	it("AreaBadge uses the area fill and ink", () => {
		const html = renderToString(
			createElement(AreaBadge, { area: "billing", children: "Pro" }),
		);
		expect(classesOf(html, "area-badge")).toEqual(
			expect.arrayContaining([
				"bg-area-billing",
				"text-area-billing-foreground",
			]),
		);
		expect(html).toContain(">Pro<");
	});

	it("AreaBackdrop is decorative and built from area tokens", () => {
		const html = renderToString(createElement(AreaBackdrop, {}));
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain("var(--area-users)");
		expect(html).toContain("var(--area-billing)");
		expect(html).toContain("var(--background)");
	});
});

describe("PageHeader", () => {
	it("PageHeader renders exactly one h1 and the actions slot", () => {
		const html = renderToString(
			createElement(PageHeader, {
				title: "Members",
				description: "Invite teammates",
				actions: createElement("button", { type: "button" }, "Invite"),
				area: "users",
				icon: createElement("svg", { "data-testid": "header-icon" }),
			}),
		);
		expect(html).toContain('data-slot="page-header"');
		expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
		expect(html).toMatch(/<h1[^>]*>Members<\/h1>/);
		expect(html).toContain(">Invite teammates<");
		expect(html).toMatch(
			/data-slot="page-header-actions"[^>]*>(<[^>]*>)*<button[^>]*>Invite<\/button>/,
		);
		expect(html).toMatch(
			/data-slot="area-icon"[^>]*>(<[^>]*>)*<svg data-testid="header-icon"/,
		);
		expect(html.indexOf("area-icon")).toBeLessThan(html.indexOf("<h1"));
	});

	it("compact: visually hidden h1 plus a right-aligned actions row", () => {
		const html = renderToString(
			createElement(PageHeader, {
				variant: "compact",
				title: "Contacts",
				actions: createElement("button", { type: "button" }, "New contact"),
			}),
		);
		expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
		expect(html).toMatch(/<h1 class="sr-only">Contacts<\/h1>/);
		expect(html).toContain('data-variant="compact"');
		expect(classesOf(html, "page-header")).toEqual(
			expect.arrayContaining(["flex", "justify-end"]),
		);
		expect(html).toMatch(
			/data-slot="page-header-actions"[^>]*>(<[^>]*>)*<button[^>]*>New contact<\/button>/,
		);
		expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("<button"));
	});

	it("compact without actions renders only the hidden h1, taking no space", () => {
		const html = renderToString(
			createElement(PageHeader, { variant: "compact", title: "Sessions" }),
		);
		expect(html).toBe(
			'<h1 data-slot="page-header" data-variant="compact" class="sr-only">Sessions</h1>',
		);
	});

	it("omits description, actions and icon when not given", () => {
		const html = renderToString(createElement(PageHeader, { title: "Plain" }));
		expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
		expect(html).not.toContain("page-header-actions");
		expect(html).not.toContain("area-icon");
		expect(html).not.toContain("<p");
	});
});
