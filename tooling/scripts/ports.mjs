#!/usr/bin/env node
/**
 * pnpm ports                 this project's slot + every project on this machine
 * pnpm ports ensure          assign a slot if missing (runs before every `pnpm dev`)
 * pnpm ports set <slot>      move this project to a specific slot
 * pnpm ports reassign        move this project to the next free slot
 * pnpm ports release [path]  free a project's slot (default: this project)
 * pnpm ports pin [slot]      make a slot the team's preferred slot (default: the
 *                            current one) — written to package.json, commit it
 * pnpm ports unpin           remove the preferred slot
 *
 * Writes .fuutu/project.json (per project) and ~/.fuutu/projects.json (per
 * machine). Both are generated — change them only through these commands.
 */
import {
	ensureSlot,
	findRoot,
	isPortBusy,
	pinSlot,
	readPreferredSlot,
	readProject,
	readRegistry,
	releaseSlot,
	setSlot,
	staleProjects,
} from "../ports/index.mjs";

const root = findRoot();
const [command = "list", arg] = process.argv.slice(2);
const out = (s = "") => process.stdout.write(`${s}\n`);

async function list() {
	const project =
		readProject(root) ?? (await ensureSlot(root, { touch: false }));
	out(`${project.name}  slot ${project.slot}   (${root}/.fuutu/project.json)`);
	for (const [key, port] of Object.entries(project.ports)) {
		const up = (await isPortBusy(port)) ? "up" : "-";
		out(`  ${key.padEnd(13)} ${String(port).padEnd(6)} ${up}`);
	}
	out(`  database      ${project.database}`);
	const preferred = readPreferredSlot(root);
	out(
		`  preferred     ${preferred === undefined ? "none (pin one with `pnpm ports pin`)" : `slot ${preferred} (package.json)`}`,
	);
	out("");
	const registry = readRegistry();
	const stale = new Set(staleProjects(registry).map((p) => p.path));
	out("All projects on this machine (~/.fuutu/projects.json):");
	for (const [path, p] of Object.entries(registry.projects).sort(
		(a, b) => a[1].slot - b[1].slot,
	)) {
		const mark = path === root ? "*" : " ";
		const note = stale.has(path) ? "  (not started for 90+ days)" : "";
		out(` ${mark} slot ${String(p.slot).padEnd(4)} ${path}${note}`);
	}
}

const commands = {
	list,
	ensure: async () => {
		const p = await ensureSlot(root);
		if (p.notice) out(`[ports] ${p.notice}`);
		out(
			`[ports] ${p.name}: slot ${p.slot} — SaaS ${p.urls.saas} · Marketing ${p.urls.marketing} · Docs ${p.urls.docs}`,
		);
	},
	set: async () => {
		const slot = Number(arg);
		if (!Number.isInteger(slot))
			throw new Error("usage: pnpm ports set <slot>");
		const p = await setSlot(root, slot);
		out(`[ports] moved to slot ${p.slot} — restart the apps`);
	},
	reassign: async () => {
		const p = await setSlot(root, undefined);
		out(`[ports] moved to slot ${p.slot} — restart the apps`);
	},
	pin: async () => {
		const slot = arg === undefined ? readProject(root)?.slot : Number(arg);
		if (!Number.isInteger(slot))
			throw new Error("usage: pnpm ports pin [slot]");
		await pinSlot(root, slot);
		const p = await ensureSlot(root);
		out(
			`[ports] preferred slot ${slot} written to package.json — commit it so every clone uses the same ports`,
		);
		if (p.notice) out(`[ports] ${p.notice}`);
	},
	unpin: async () => {
		await pinSlot(root, undefined);
		out("[ports] preferred slot removed from package.json");
	},
	release: async () => {
		await releaseSlot(arg ?? root);
		out(`[ports] released ${arg ?? root}`);
	},
};

if (!commands[command]) {
	out(
		`unknown command "${command}" — use list | ensure | set <slot> | reassign | pin [slot] | unpin | release [path]`,
	);
	process.exit(1);
}
commands[command]().catch((err) => {
	out(`[ports] ${err.message}`);
	process.exit(1);
});
