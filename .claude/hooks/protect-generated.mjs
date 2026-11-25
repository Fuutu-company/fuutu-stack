#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook: generated files are produced by their tool's
 * command, never written by hand. Blocks Write/Edit/MultiEdit on generated
 * paths and Bash commands that write into them, and tells the agent which
 * command to run instead. Reading and the generator commands stay allowed.
 *
 * The rules live in tooling/generated-files — add yours there.
 */
import { readFileSync } from "node:fs";
import {
	GENERATED,
	matchGeneratedCommand,
	matchGeneratedPath,
} from "../../tooling/generated-files/index.mjs";

export { GENERATED };

export function check(toolName, input) {
	if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) {
		return matchGeneratedPath(
			String(input.file_path ?? input.notebook_path ?? ""),
		);
	}
	if (toolName === "Bash") {
		return matchGeneratedCommand(String(input.command ?? ""));
	}
	return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	let event = {};
	try {
		event = JSON.parse(readFileSync(0, "utf8") || "{}");
	} catch {
		process.exit(0);
	}
	const hit = check(event.tool_name, event.tool_input ?? {});
	if (hit) {
		process.stderr.write(
			`Blocked: ${hit.label} are generated — never create or change them by hand.\nRun instead: ${hit.command}\n`,
		);
		process.exit(2);
	}
	process.exit(0);
}
