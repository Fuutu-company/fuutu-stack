#!/usr/bin/env node
/**
 * Bundles what `prisma migrate deploy` needs into one self-contained
 * directory for a deploy image (Railpack ships only `.next/standalone`,
 * which has no Prisma CLI, schema or migrations):
 *
 *   <out>/prisma.config.ts, prisma/schema, prisma/migrations  (from packages/db)
 *   <out>/node_modules  the installed `prisma` + `dotenv` and their dependency
 *                       closure, copied from the pnpm store — the lockfile
 *                       versions, no network, no full monorepo node_modules
 *                       plus the schema engine for this platform, fetched at
 *                       build time so the container never downloads at start
 *
 *   node tooling/deploy/bundle-migrate.mjs apps/saas/.next/standalone/migrate
 *
 * Run it from the repo root after `pnpm install`. `start-with-migrate.mjs`
 * runs the bundle.
 */
import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = process.cwd();
const DB_DIR = join(ROOT, "packages/db");
/** Packages the bundle's `prisma.config.ts` and CLI run need. */
const ENTRY_PACKAGES = ["prisma", "dotenv"];
/**
 * Optional peers pnpm links next to the CLI that `migrate deploy` never
 * loads (the type checker is the largest of them).
 */
const SKIP = new Set(["typescript", "@types/react", "@types/react-dom"]);

function fail(message) {
	process.stderr.write(`[bundle-migrate] ${message}\n`);
	process.exit(1);
}

const out = process.argv[2];
if (!out) fail("usage: bundle-migrate.mjs <out-dir>");
const OUT = resolve(ROOT, out);
const STORE = join(ROOT, "node_modules/.pnpm");
if (!existsSync(STORE)) fail("node_modules/.pnpm missing — run pnpm install");

/** `.pnpm/<key>` directory that holds a package's real path. */
function storeKeyDir(realPath) {
	const rel = relative(STORE, realPath);
	if (rel.startsWith("..")) fail(`${realPath} is not in the pnpm store`);
	return join(STORE, rel.split(sep)[0]);
}

/** Entries of `.pnpm/<key>/node_modules` (scoped names flattened). */
function linkedPackages(keyDir) {
	const modules = join(keyDir, "node_modules");
	const names = [];
	for (const entry of readdirSync(modules)) {
		if (entry.startsWith("@")) {
			for (const sub of readdirSync(join(modules, entry))) {
				names.push(`${entry}/${sub}`);
			}
		} else if (entry !== ".bin") {
			names.push(entry);
		}
	}
	return names.map((name) => ({ name, path: join(modules, name) }));
}

// Dependency closure: every store entry reachable through the symlinks
// pnpm laid out next to each package.
const keyDirs = new Set();
const queue = ENTRY_PACKAGES.map((name) => {
	const link = join(DB_DIR, "node_modules", name);
	if (!existsSync(link)) fail(`${name} is not installed in packages/db`);
	return storeKeyDir(realpathSync(link));
});
while (queue.length > 0) {
	const keyDir = queue.pop();
	if (keyDirs.has(keyDir)) continue;
	keyDirs.add(keyDir);
	for (const { name, path } of linkedPackages(keyDir)) {
		if (SKIP.has(name) || !lstatSync(path).isSymbolicLink()) continue;
		if (!existsSync(path)) continue; // unresolved optional peer
		queue.push(storeKeyDir(realpathSync(path)));
	}
}

rmSync(OUT, { recursive: true, force: true });
const outStore = join(OUT, "node_modules/.pnpm");
mkdirSync(outStore, { recursive: true });
for (const keyDir of keyDirs) {
	// verbatimSymlinks keeps pnpm's relative sibling links pointing inside
	// the copy.
	cpSync(keyDir, join(outStore, relative(STORE, keyDir)), {
		recursive: true,
		verbatimSymlinks: true,
	});
}
for (const name of ENTRY_PACKAGES) {
	const real = realpathSync(join(DB_DIR, "node_modules", name));
	const target = join(outStore, relative(STORE, real));
	const link = join(OUT, "node_modules", name);
	mkdirSync(dirname(link), { recursive: true });
	symlinkSync(relative(dirname(link), target), link);
}

cpSync(join(DB_DIR, "prisma.config.ts"), join(OUT, "prisma.config.ts"));
cpSync(join(DB_DIR, "prisma/schema"), join(OUT, "prisma/schema"), {
	recursive: true,
});
cpSync(join(DB_DIR, "prisma/migrations"), join(OUT, "prisma/migrations"), {
	recursive: true,
});
writeFileSync(
	join(OUT, "package.json"),
	`${JSON.stringify({ name: "fuutu-migrate", private: true, type: "module" }, null, "\t")}\n`,
);

// Fetch the schema engine now (pnpm skips @prisma/engines' postinstall): it
// lands next to @prisma/engines, where the CLI looks first, so the container
// never downloads at start.
const enginesDir = realpathSync(
	join(realpathSync(join(OUT, "node_modules/prisma")), "../@prisma/engines"),
);
const fetched = spawnSync(
	process.execPath,
	[join(enginesDir, "scripts/postinstall.js")],
	{
		stdio: "inherit",
		// The checksum check stays on even if the build env tries to skip it.
		env: {
			...process.env,
			PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: undefined,
			PRISMA_HIDE_UPDATE_MESSAGE: "1",
		},
	},
);
if (fetched.status !== 0) fail("schema engine download failed");
if (!readdirSync(enginesDir).some((f) => f.startsWith("schema-engine"))) {
	fail(`no schema engine in ${enginesDir} after download`);
}

const version = JSON.parse(
	readFileSync(join(OUT, "node_modules/prisma/package.json"), "utf8"),
).version;
process.stdout.write(
	`[bundle-migrate] prisma ${version}, ${keyDirs.size} packages → ${relative(ROOT, OUT)}\n`,
);
