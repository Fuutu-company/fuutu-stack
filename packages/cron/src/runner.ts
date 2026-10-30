import { cronConfig } from "./config";
import { InlineJobRunner } from "./runners/inline";
import { TriggerDevJobRunner } from "./runners/trigger-dev";
import type { CronJobResult, JobRunner } from "./types";

let inlineRunner: InlineJobRunner | undefined;
let triggerDevRunner: TriggerDevJobRunner | undefined;

/**
 * Resolve the active job runner from `cronConfig.runner`.
 *
 * Provider instances are lazily created once and then cached as
 * singletons — consistent with mail/storage/ai, but only the selected
 * runner is constructed. The inline runner is always available; the
 * Trigger.dev runner is a skeleton that throws until wired up.
 */
export function resolveJobRunner(): JobRunner {
	switch (cronConfig.runner) {
		case "inline":
			inlineRunner ??= new InlineJobRunner();
			return inlineRunner;
		case "trigger-dev":
			triggerDevRunner ??= new TriggerDevJobRunner();
			return triggerDevRunner;
		default:
			// Unreachable for the closed JobRunnerId union — kept as a
			// runtime guard against out-of-union values (e.g. casts).
			throw new Error(`Unknown cron runner: ${cronConfig.runner}`);
	}
}

/**
 * Run a specific job by name via the active runner.
 */
export async function runJob(name: string): Promise<CronJobResult> {
	return resolveJobRunner().run(name);
}

/**
 * Run all enabled jobs via the active runner.
 */
export async function runAllJobs(): Promise<Record<string, CronJobResult>> {
	return resolveJobRunner().runAll();
}

/**
 * List all registered jobs via the active runner.
 */
export function listJobs() {
	return resolveJobRunner().list();
}
