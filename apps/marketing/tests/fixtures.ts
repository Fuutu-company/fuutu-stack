import { test as base, expect } from "@playwright/test";

const COVERAGE_ENABLED = process.env.COVERAGE === "1";

type JSCoverageEntry = {
	url: string;
	scriptId: string;
	source?: string;
	functions: Array<{
		functionName: string;
		isBlockCoverage: boolean;
		ranges: Array<{ count: number; startOffset: number; endOffset: number }>;
	}>;
};

const COVERAGE_DIR = "coverage-v8/raw";
let chunkIndex = 0;

/**
 * Auto-accepts the analytics consent banner by setting localStorage
 * before any page loads. This prevents the banner from appearing
 * in screenshots and interfering with tests.
 *
 * When COVERAGE=1 is set, collects V8 JS coverage for every page navigation
 * and writes it to disk for aggregation in the global teardown.
 */
export const test = base.extend({
	page: async ({ page }, use) => {
		await page.addInitScript(() => {
			// biome-ignore lint/suspicious/noDocumentCookie: addInitScript runs before DOMContentLoaded, Cookie Store API unavailable
			document.cookie = "fuutu.consent.v1=granted; path=/; SameSite=Lax";
		});

		if (COVERAGE_ENABLED) {
			await page.coverage.startJSCoverage({
				resetOnNavigation: true,
				reportAnonymousScripts: false,
			});
		}

		await use(page);

		if (COVERAGE_ENABLED) {
			const coverage = await page.coverage.stopJSCoverage();
			await writeCoverageChunk(coverage);
		}
	},
});

export { expect };

async function writeCoverageChunk(entries: JSCoverageEntry[]) {
	if (entries.length === 0) return;
	const { writeFileSync, mkdirSync } = await import("node:fs");
	const { join } = await import("node:path");

	mkdirSync(join(process.cwd(), COVERAGE_DIR), { recursive: true });
	const filename = join(
		process.cwd(),
		COVERAGE_DIR,
		`chunk-${process.pid}-${chunkIndex++}.json`,
	);
	writeFileSync(filename, JSON.stringify(entries));
}

export async function flushCoverage() {
	if (!COVERAGE_ENABLED) return;

	const { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } =
		await import("node:fs");
	const { join } = await import("node:path");

	const rawDir = join(process.cwd(), COVERAGE_DIR);
	mkdirSync(rawDir, { recursive: true });

	const files = readdirSync(rawDir).filter((f) => f.endsWith(".json"));
	if (files.length === 0) {
		process.stdout.write("\n📊 Coverage: no data collected\n");
		return;
	}

	const allEntries: JSCoverageEntry[] = [];
	for (const file of files) {
		try {
			const data = JSON.parse(
				readFileSync(join(rawDir, file), "utf-8"),
			) as JSCoverageEntry[];
			allEntries.push(...data);
		} catch {
			// skip corrupt chunks
		}
	}

	// Deduplicate by scriptId — same script may appear across navigations
	const seen = new Set<string>();
	const deduped = allEntries.filter((e) => {
		if (seen.has(e.scriptId)) return false;
		seen.add(e.scriptId);
		return true;
	});

	const filtered = deduped.filter(
		(entry) =>
			entry.url.includes("_next/static/chunks/") &&
			!entry.url.includes("node_modules"),
	);

	const summary = {
		totalScripts: deduped.length,
		appScripts: filtered.length,
		totalBytes: 0,
		usedBytes: 0,
		scripts: [] as Array<{
			url: string;
			total: number;
			used: number;
			pct: number;
		}>,
	};

	for (const entry of filtered) {
		const total = entry.functions.reduce(
			(acc: number, fn) =>
				acc +
				fn.ranges.reduce((a: number, r) => a + r.endOffset - r.startOffset, 0),
			0,
		);
		const used = entry.functions.reduce((acc: number, fn) => {
			const longest = fn.ranges.reduce(
				(max: number, r) => Math.max(max, r.endOffset - r.startOffset),
				0,
			);
			return acc + longest;
		}, 0);

		summary.totalBytes += total;
		summary.usedBytes += used;
		summary.scripts.push({
			url: entry.url.split("/").pop() ?? entry.url,
			total,
			used,
			pct: total > 0 ? Math.round((used / total) * 100) : 0,
		});
	}

	summary.scripts.sort((a, b) => b.total - a.total);

	const overallPct =
		summary.totalBytes > 0
			? Math.round((summary.usedBytes / summary.totalBytes) * 100)
			: 0;

	const outDir = join(process.cwd(), "coverage-v8");
	const report = [
		"# E2E Code Coverage Report",
		"",
		`**Overall: ${overallPct}%** (${formatBytes(summary.usedBytes)} / ${formatBytes(summary.totalBytes)})`,
		"",
		`Scripts analyzed: ${summary.appScripts} (filtered from ${summary.totalScripts} total)`,
		"",
		"| Script | Used | Total | Coverage |",
		"|---|---|---|---|",
		...summary.scripts.map(
			(s) =>
				`| ${s.url} | ${formatBytes(s.used)} | ${formatBytes(s.total)} | ${s.pct}% |`,
		),
	].join("\n");

	writeFileSync(join(outDir, "coverage-report.md"), report);

	const json = {
		overall: {
			pct: overallPct,
			used: summary.usedBytes,
			total: summary.totalBytes,
		},
		scripts: summary.scripts,
	};
	writeFileSync(
		join(outDir, "coverage-summary.json"),
		JSON.stringify(json, null, 2),
	);

	// Clean up raw chunks
	rmSync(rawDir, { recursive: true, force: true });

	process.stdout.write(
		`\n📊 Coverage: ${overallPct}% (${formatBytes(summary.usedBytes)} / ${formatBytes(summary.totalBytes)}) — ${summary.appScripts} scripts — report at ${outDir}/coverage-report.md\n`,
	);
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * Scrolls through the entire page to trigger all `whileInView`
 * framer-motion animations. Without this, elements that start at
 * opacity:0 and animate on scroll-into-view remain invisible
 * in full-page screenshots.
 *
 * Usage in visual tests:
 *   await page.goto("/en");
 *   await page.waitForLoadState("domcontentloaded");
 *   await scrollThroughPage(page);
 *   await expect(page).toHaveScreenshot(...);
 */
export async function scrollThroughPage(page: import("@playwright/test").Page) {
	await page.evaluate(async () => {
		await new Promise<void>((resolve) => {
			let scrolled = 0;
			const step = window.innerHeight;
			const timer = setInterval(() => {
				window.scrollBy(0, step);
				scrolled += step;
				if (scrolled >= document.body.scrollHeight) {
					clearInterval(timer);
					window.scrollTo(0, 0);
					resolve();
				}
			}, 50);
		});
	});
	await page
		.waitForFunction(
			() => document.getAnimations().every((a) => a.playState === "finished"),
			undefined,
			{ timeout: 3000 },
		)
		.catch(() => {});
}
