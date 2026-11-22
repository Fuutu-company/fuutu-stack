import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: no blocking on a runtime from the desktop app's async code.
 *
 * Blocking on a runtime from a thread that drives the app's tokio runtime
 * panics ("Cannot start a runtime from within a runtime") or stalls it.
 * Linux hit it at every start: the keychain (Secret Service) is zbus 5's
 * blocking API, which with zbus's `tokio` feature — any crate in the app may
 * turn it on — blocks on a runtime of its own. The Linux-only paths are
 * invisible to clippy and tests on macOS and Windows, so this scans the kit's
 * Rust source on every OS: each blocking call must be a reviewed one below.
 * Test code (`#[cfg(test)]` items) is skipped. Your own crates
 * (`src-tauri/app-ext`, `crates/`, `src/app_plugins.rs`) are yours to guard.
 *
 * New call: run it on a thread of its own (`std::thread`,
 * `tokio::task::spawn_blocking`, `off_async_runtime` in `auth/store.rs`) or
 * use the async API — then add it here with the reason.
 */

const SRC_TAURI = join(
	import.meta.dirname,
	"../../../../apps/desktop/src-tauri",
);
const hasDesktop = existsSync(SRC_TAURI);
/** Kit-owned Rust: everything but the app's own crates and hooks. */
const SKIP_DIRS = new Set(["target", "gen", "tests", "app-ext", "crates"]);
const APP_FILES = new Set(["src/app_plugins.rs", "app_build.rs"]);

/** Calls that block the thread on a runtime or a channel. */
const BLOCKING =
	/\bblock_on\s*\(|\bblocking_(?:recv|send|lock|read|write)\s*\(|\bblock_in_place\b|futures::executor|zbus::blocking|async_io::block_on|futures_lite::future::block_on/;

/** Reviewed blocking calls in kit code: `line` is a substring of the source line. */
const ALLOWED: { file: string; line: string; why: string }[] = [];

function rustFiles(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			if (!SKIP_DIRS.has(name) && !name.startsWith(".")) rustFiles(path, out);
		} else if (name.endsWith(".rs")) out.push(path);
	}
	return out;
}

/**
 * Production source: test items blanked. A top-level `#[cfg(test)]` (or
 * `#[cfg(all(test, …))]`) item runs to the line where its braces balance;
 * line numbers stay as in the file.
 */
function productionLines(source: string): string[] {
	const out: string[] = [];
	let test: { depth: number; braced: boolean } | null = null;
	for (const line of source.split("\n")) {
		if (!test && /^#\[cfg\((?:all\()?test\b/.test(line)) {
			test = { depth: 0, braced: false };
			out.push("");
			continue;
		}
		if (!test) {
			out.push(line);
			continue;
		}
		out.push("");
		const code = line.replace(/\/\/.*$/, "");
		const opened = (code.match(/\{/g) ?? []).length;
		test.depth += opened - (code.match(/\}/g) ?? []).length;
		if (opened > 0) test.braced = true;
		// The item ends where its braces balance, or at the `;` of a one-line item.
		if (test.braced ? test.depth <= 0 : code.trim().endsWith(";")) test = null;
	}
	return out;
}

function blockingCalls(): { file: string; text: string; n: number }[] {
	const hits = [];
	for (const path of rustFiles(SRC_TAURI)) {
		const file = relative(SRC_TAURI, path);
		if (APP_FILES.has(file)) continue;
		const lines = productionLines(readFileSync(path, "utf8"));
		for (const [i, text] of lines.entries()) {
			if (BLOCKING.test(text.replace(/\/\/.*$/, ""))) {
				hits.push({ file, text: text.trim(), n: i + 1 });
			}
		}
	}
	return hits;
}

describe.skipIf(!hasDesktop)(
	"desktop: no blocking on a runtime from async code",
	() => {
		it("skips test items and keeps the code around them", () => {
			const src =
				"a\n#[cfg(test)]\nmod tests {\n    fn t() { block_on(x) }\n}\nfn b() { block_on(y) }";
			expect(productionLines(src)).toEqual([
				"a",
				"",
				"",
				"",
				"",
				"fn b() { block_on(y) }",
			]);
			expect(productionLines("#[cfg(test)]\nuse x;\nfn c() {}")).toEqual([
				"",
				"",
				"fn c() {}",
			]);
		});

		it("every blocking call in kit code is a reviewed one", () => {
			const unreviewed = blockingCalls()
				.filter(
					(h) =>
						!ALLOWED.some((a) => a.file === h.file && h.text.includes(a.line)),
				)
				.map((h) => `${h.file}:${h.n}: ${h.text}`);
			expect(unreviewed).toEqual([]);
		});

		it("has no stale entries", () => {
			const hits = blockingCalls();
			const stale = ALLOWED.filter(
				(a) => !hits.some((h) => h.file === a.file && h.text.includes(a.line)),
			).map((a) => `${a.file}: ${a.line}`);
			expect(stale).toEqual([]);
		});

		it("the keychain (Secret Service on Linux) runs off the async runtime", () => {
			const store = readFileSync(join(SRC_TAURI, "src/auth/store.rs"), "utf8");
			const arms = [
				...store.matchAll(
					/Backend::Keychain \{ service \} =>([\s\S]*?)Backend::File/g,
				),
			].map((m) => m[1] ?? "");
			expect(arms).toHaveLength(3);
			for (const arm of arms) {
				expect(arm).toContain("off_async_runtime(");
			}
			expect(store).toMatch(
				/tokio::runtime::Handle::try_current\(\)\.is_err\(\)/,
			);
		});
	},
);
