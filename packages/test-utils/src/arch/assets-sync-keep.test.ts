import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	assetSkips,
	parseKeepFile,
} from "../../../../tooling/scripts/lib/asset-skips.mjs";

const root = join(import.meta.dirname, "../../../..");

describe("pnpm assets:sync — app-owned keep.txt", () => {
	it("reads one filename per line, ignoring # comments and blank lines", () => {
		expect(
			parseKeepFile(
				"# own artwork\napp-icon.png\n\n  favicon.svg  # hand-tuned\r\n#og-image.png\n",
			),
		).toEqual(["app-icon.png", "favicon.svg"]);
	});

	it("merges keep.txt with --skip and remembers why each file is left alone", () => {
		const skips = assetSkips({
			argv: ["node", "assets-sync.mjs", "--skip=favicon.svg, og-image.png"],
			keepText: "app-icon.png\nfavicon.svg\n",
		});
		expect([...skips.keys()].sort()).toEqual([
			"app-icon.png",
			"favicon.svg",
			"og-image.png",
		]);
		expect(skips.get("app-icon.png")).toBe("keep.txt");
		expect(skips.get("og-image.png")).toBe("--skip");
		// Named in both: --skip on the command line wins the label.
		expect(skips.get("favicon.svg")).toBe("--skip");
	});

	it("works without keep.txt or --skip", () => {
		expect(assetSkips({ argv: [], keepText: null }).size).toBe(0);
	});

	it("the kit ships no keep.txt (it is app-owned)", () => {
		expect(existsSync(join(root, "packages/config/assets/keep.txt"))).toBe(
			false,
		);
	});
});
