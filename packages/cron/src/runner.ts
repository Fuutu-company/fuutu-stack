import { createLogger } from "@fuutu/logs";
import { cronConfig } from "./config";
import { InlineJobRunner } from "./runners/inline";
import { TriggerDevJobRunner } from "./runners/trigger-dev";
import type { CronJobResult, JobRunner } from "./types";

const _log = createLogger({ scope: "cron:resolve" });

const inlineRunner = new InlineJobRunner();
const triggerDevRunner = new TriggerDevJobRunner();

/**
 * Resolve the active job runner from `cronConfig.runner`.
 *
 * Provider instances are cached as singletons (module-level) — consistent
 * with mail/storage/ai. The inline runner is always available; the
 * Trigger.dev runner is a skeleton that throws until wired up.
 */
export function resolveJobRunner(): JobRunner {
	switch (cronConfig.runner) {
		case "inline":
			return inlineRunner;
		case "trigger-dev":
			return triggerDevRunner;
		default:
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
