import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The app-shell content column is a flex child of the sidebar provider. A
 * flex item defaults to `min-width: auto`, so without `min-w-0` it grows to
 * its widest child and wide tables overflow the page instead of scrolling
 * inside their own `overflow-x-auto` container.
 */
const LAYOUT = join(
	import.meta.dirname,
	"../../../../../apps/saas/src/modules/app/layouts/dashboard-layout.tsx",
);

describe("app shell content column", () => {
	it("SidebarInset can shrink below its content width (min-w-0)", () => {
		const source = readFileSync(LAYOUT, "utf8");
		expect(source).toMatch(/<SidebarInset[^>]*className="[^"]*\bmin-w-0\b/);
	});
});
