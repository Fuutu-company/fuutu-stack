#!/usr/bin/env node
/** Removes source maps (and their references) from `out/` before bundling. */
import {
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../out");
let removed = 0;
function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full);
		else if (entry.endsWith(".map")) {
			rmSync(full);
			removed++;
		} else if (entry.endsWith(".js") || entry.endsWith(".css")) {
			const src = readFileSync(full, "utf8");
			const clean = src.replace(
				/\n?\/[/*][#@] sourceMappingURL=\S+?(\s*\*\/)?\s*$/,
				"",
			);
			if (clean !== src) writeFileSync(full, clean);
		}
	}
}
walk(outDir);
console.log(`stripped ${removed} source maps from out/`);
