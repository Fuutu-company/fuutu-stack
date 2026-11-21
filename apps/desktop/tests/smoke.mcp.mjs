#!/usr/bin/env node
/**
 * Desktop smoke test over MCP — drives the RUNNING dev app
 * (`pnpm dev:desktop`) through its automation bridge, like an agent would
 * (check-in-desktop skill). macOS, Windows and Linux alike; not part of
 * `pnpm test` (it needs the app window).
 *
 *   pnpm -F @fuutu/desktop-app smoke
 *
 * Checks: the bridge answers, the shell renders (or, signed out with auth
 * `required`, the sign-in gate), the Rust commands answer (`auth_status`,
 * `updates_status`), Settings and Account render, no uncaught page errors.
 * Screenshots: .fuutu/desktop-shots/smoke-<step>.png. Exit 1 on a failure.
 */
import { renameSync } from "node:fs";
import { join } from "node:path";
import { findRoot, readProject } from "../../../tooling/ports/index.mjs";
import {
	connectDesktopMcp,
	renderResult,
} from "../../../tooling/scripts/desktop-mcp/call.mjs";

const root = findRoot();
const project = readProject(root);
if (!project) {
	process.stderr.write("smoke: no port slot — run `pnpm dev:desktop` first\n");
	process.exit(1);
}
const shots = join(root, ".fuutu/desktop-shots");
const results = [];
let client;

function textOf(result) {
	return (result?.content ?? [])
		.filter((item) => item.type === "text")
		.map((item) => item.text)
		.join("\n");
}

async function call(tool, args) {
	const result = await client.call(tool, args);
	if (result?.isError) throw new Error(`${tool}: ${textOf(result)}`);
	return result;
}

/** Runs `script` (an async function body) in the main window, returns its JSON. */
async function evaluate(body) {
	const result = await call("webview_execute_js", {
		script: `(async () => JSON.stringify(await (async () => { ${body} })()))()`,
	});
	const line = textOf(result)
		.split("\n")
		.find((l) => l.trim().startsWith("{") || l.trim().startsWith("["));
	if (!line) throw new Error(`no JSON from the webview: ${textOf(result)}`);
	return JSON.parse(line);
}

async function screenshot(step) {
	const result = await call("webview_screenshot", {});
	const out = renderResult(result, shots, `smoke-${step}`);
	const file = out.match(/\[image\] (.+\.png)/)?.[1];
	if (!file) return null;
	const target = join(shots, `smoke-${step}.png`);
	renameSync(file, target);
	return target;
}

async function step(name, run) {
	try {
		const detail = await run();
		results.push({ name, ok: true, detail });
	} catch (err) {
		results.push({
			name,
			ok: false,
			detail: err instanceof Error ? err.message : String(err),
		});
	}
}

// Each webview_execute_js call must answer within 5 s (bridge limit).
const WAIT = `const wait = async (test, ms = 3000) => {
	for (let t = 0; t < ms; t += 200) {
		if (test()) return true;
		await new Promise((r) => setTimeout(r, 200));
	}
	return false;
};`;

/**
 * Client-side navigation through the shell's own links (static export:
 * `/settings/`). Closes an open dialog (e.g. an offered update) first.
 */
const go = (path) => `${WAIT}
	const norm = (p) => p.replace(/\\.html$/, "").replace(/(.)\\/$/, "$1");
	if (document.querySelector("[role=dialog]")) {
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await wait(() => !document.querySelector("[role=dialog]"), 800);
	}
	const link = [...document.querySelectorAll("a[href]")].find((a) => norm(a.getAttribute("href")) === "${path}");
	if (!link) return { ok: false, reason: "no link to ${path}" };
	link.click();
	const ok = await wait(() => norm(location.pathname) === "${path}");
	await new Promise((r) => setTimeout(r, 500));
	document.getAnimations().forEach((a) => a.finish());
	return { ok, path: location.pathname, headings: [...document.querySelectorAll("h1,h2,[data-slot=card-title]")].map((h) => h.textContent.trim()).filter(Boolean) };`;

try {
	client = await connectDesktopMcp({ root });
	await step("bridge", async () => {
		await call("driver_session", {
			action: "start",
			port: project.ports.desktopBridge,
		});
		// The bridge answers before the webview has loaded its page and the
		// bridge's script helpers (slow runners: seconds); wait for both.
		for (let attempt = 1; ; attempt++) {
			try {
				await evaluate("return document.readyState;");
				break;
			} catch (err) {
				if (attempt >= 30) throw err;
				await new Promise((r) => setTimeout(r, 2000));
			}
		}
		return `connected on ${project.ports.desktopBridge}`;
	});
	if (!results[0].ok) throw new Error(results[0].detail);

	let signedIn = false;
	let gated = false;
	await step("rust commands", async () => {
		const state = await evaluate(`
			const invoke = window.__TAURI__.core.invoke;
			return { auth: await invoke("auth_status"), updates: await invoke("updates_status") };`);
		if (typeof state.auth?.mode !== "string") throw new Error("auth_status");
		if (typeof state.updates?.enabled !== "boolean")
			throw new Error("updates_status");
		signedIn = state.auth.mode === "off" || state.auth.signedIn === true;
		return `auth ${state.auth.mode}${state.auth.signedIn ? " (signed in)" : ""}, updates ${state.updates.enabled ? "on" : "off"}`;
	});

	await step("shell", async () => {
		// Window-level errors from now on (the bridge reads them back below).
		const state = await evaluate(`${WAIT}
			window.__smokeErrors = [];
			window.addEventListener("error", (e) => window.__smokeErrors.push(String(e.message)));
			window.addEventListener("unhandledrejection", (e) => window.__smokeErrors.push(String(e.reason)));
			const ready = await wait(() => document.querySelector("a[href], button"));
			const heading = document.querySelector("h1,h2,[data-slot=card-title]");
			return { ready, nav: document.querySelectorAll("nav a[href]").length, title: document.title, heading: heading?.textContent?.trim() ?? "" };`);
		if (!state.ready) throw new Error("nothing rendered");
		// Signed in without access (device limit, no plan, …): the access
		// gate replaces the shell — a valid state, the pages are unreachable.
		gated = signedIn && state.nav === 0;
		const shown = gated
			? `access gate "${state.heading}"`
			: signedIn
				? `${state.nav} nav links`
				: "sign-in gate";
		return `${shown}, title "${state.title}" — ${await screenshot("shell")}`;
	});

	if (signedIn && !gated) {
		await step("settings", async () => {
			const state = await evaluate(go("/settings"));
			if (!state.ok) throw new Error(state.reason ?? `stayed on ${state.path}`);
			if (state.headings.length < 2) throw new Error("settings cards missing");
			return `${state.headings.join(" · ")} — ${await screenshot("settings")}`;
		});
		await step("account", async () => {
			const state = await evaluate(go("/settings/account"));
			if (!state.ok) throw new Error(state.reason ?? `stayed on ${state.path}`);
			return `${state.headings.join(" · ")} — ${await screenshot("account")}`;
		});
		await step("home", async () => {
			const state = await evaluate(go("/"));
			if (!state.ok) throw new Error(state.reason ?? `stayed on ${state.path}`);
			return state.path;
		});
	} else {
		results.push({
			name: "settings, account, home",
			ok: true,
			detail: gated
				? "skipped — access gate shown; give the account access to check them"
				: "skipped — signed out (sign-in gate shown); sign in to check them",
		});
	}

	await step("no page errors", async () => {
		const errors = await evaluate("return window.__smokeErrors ?? [];");
		if (errors.length) throw new Error(errors.join(" | "));
		return "none";
	});
} catch (err) {
	results.push({
		name: "setup",
		ok: false,
		detail: err instanceof Error ? err.message : String(err),
	});
} finally {
	client?.close();
}

for (const r of results) {
	process.stdout.write(`${r.ok ? "✓" : "✗"} ${r.name}: ${r.detail}\n`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
