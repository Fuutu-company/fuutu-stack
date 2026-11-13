import type { CronJob } from "./types";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Your scheduled jobs, registered next to the kit's built-in jobs
 * (`./jobs/index.ts`) — add them here instead of editing that file. Each
 * goes through `registerJob`: the schedule is validated (an invalid one
 * logs an error and runs on every trigger), and a job reusing a built-in
 * name replaces it (logged as a warning) — the way to override one.
 *
 * The registry is seeded once per server process — after editing this
 * list, restart the dev server (hot reload does not re-register jobs).
 *
 * Jobs run in the cron trigger (`/api/cron`, `CRON_SECRET`), so they must
 * be idempotent and use `@fuutu/db` query functions. Per-job toggles go
 * in `cronConfig.jobs` (`enabled: cronConfig.jobs["usage-rollup"] ?? true`).
 *
 * ```ts
 * export const appJobs: readonly CronJob[] = [
 *   {
 *     name: "usage-rollup",
 *     schedule: "0 * * * *",
 *     enabled: true,
 *     async run() {
 *       const processed = await rollUpUsage();
 *       return { success: true, processed, errors: [] };
 *     },
 *   },
 * ];
 * ```
 */
export const appJobs: readonly CronJob[] = [];
