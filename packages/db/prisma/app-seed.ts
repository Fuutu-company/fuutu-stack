import type { AppSeedContext } from "./seed-context";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Demo data for your app's own models, run by `pnpm db:seed` after the kit
 * seed (`seed.ts`) — add it here instead of editing that file. `ctx`
 * carries the seeded users, the Acme org and the seed start time; the same
 * local-only safety checks have already passed.
 *
 * Keep it idempotent (re-runs must not duplicate rows): upsert by a unique
 * key, or count marked rows first like the kit's demo activity.
 *
 * ```ts
 * export async function appSeed({ db, orgs, now }: AppSeedContext) {
 *   if ((await db.project.count({ where: { organizationId: orgs.acme.id } })) > 0) return;
 *   await db.project.create({
 *     data: { name: "Launch", organizationId: orgs.acme.id, createdAt: new Date(now) },
 *   });
 * }
 * ```
 */
export async function appSeed(_ctx: AppSeedContext): Promise<void> {}
