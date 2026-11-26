import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { workflowJob } from "./workflow-job";

const REPO_ROOT = join(import.meta.dirname, "../../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");

/** Workflows a clone gets switched off, with the variable that turns each on. */
const SWITCHED = [
	{ file: "ci.yml", flag: "FUUTU_CI_ENABLED" },
	{ file: "maintenance.yml", flag: "FUUTU_CI_ENABLED" },
	{ file: "pages.yml", flag: "FUUTU_PAGES_ENABLED" },
	{ file: "version.yml", flag: "FUUTU_VERSIONING_ENABLED" },
];

const jobNames = (workflow: string) => {
	const jobs = workflow.slice(workflow.indexOf("\njobs:\n"));
	return [...jobs.matchAll(/^ {2}([\w-]+):$/gm)].map((m) => m[1] as string);
};

/**
 * A switched-off workflow must request no runner: a job GitHub cannot start
 * (private repo without Actions minutes, blocked billing) fails the whole
 * run. With every job skipped the run ends "skipped". So no job may run
 * because a switch is off, and every root job runs only when it is on.
 */
describe("disabled workflows request no runner", () => {
	for (const { file, flag } of SWITCHED) {
		const workflow = read(`.github/workflows/${file}`);

		it(`${file}: no job runs because ${flag} is off`, () => {
			expect(workflow).not.toMatch(/vars\.FUUTU_\w+_ENABLED != 'true'/);
		});

		it(`${file}: every root job is gated on ${flag} == 'true'`, () => {
			const names = jobNames(workflow);
			expect(names.length).toBeGreaterThan(0);
			for (const name of names) {
				const job = workflowJob(workflow, name);
				if (/^ {4}needs:/m.test(job)) continue;
				const condition = job.match(/^ {4}if: (.+)$/m)?.[1] ?? "";
				expect(condition, `${file} → ${name}`).toContain(
					`vars.${flag} == 'true'`,
				);
				expect(condition, `${file} → ${name}`).not.toMatch(/\|\|/);
			}
		});

		it(`${file}: the run name says how to enable it`, () => {
			expect(workflow).toMatch(
				new RegExp(`^run-name: .*disabled — set ${flag}=true`, "m"),
			);
		});
	}
});
