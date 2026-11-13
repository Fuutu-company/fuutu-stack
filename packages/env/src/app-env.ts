import type { z } from "zod";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Your app's env vars, merged into the kit schemas — add them here instead
 * of editing `saas.ts` / `public.ts`, then read them typed from `env`:
 *
 * - `appServerEnv`: server-only vars, merged into `@fuutu/env/saas` only.
 *   Their values are read from `process.env` by key automatically.
 * - `appClientEnv`: `NEXT_PUBLIC_*` vars, merged into every surface
 *   (`/saas`, `/marketing`, `/docs`, `/public`) — so a required client var
 *   must be set for every app that loads env, or be `.optional()`.
 * - `appClientRuntimeEnv`: one literal `process.env.NEXT_PUBLIC_X` read
 *   per client var — Next.js inlines only literal reads into the browser
 *   bundle, so this mapping cannot be generated.
 *
 * A key the kit already defines in the same group (server / client)
 * throws at startup, naming the key — pick your own names. Document each
 * var in `.env.example`.
 *
 * ```ts
 * import { z } from "zod";
 * export const appServerEnv = {
 *   PARTNER_API_KEY: z.string().min(16),
 * } satisfies z.ZodRawShape;
 * export const appClientEnv = {
 *   NEXT_PUBLIC_SUPPORT_URL: z.url().optional(),
 * } satisfies Record<`NEXT_PUBLIC_${string}`, z.ZodType>;
 * export const appClientRuntimeEnv = {
 *   NEXT_PUBLIC_SUPPORT_URL: process.env.NEXT_PUBLIC_SUPPORT_URL,
 * } satisfies Record<keyof typeof appClientEnv, string | undefined>;
 * ```
 */
export const appServerEnv = {} satisfies z.ZodRawShape;

export const appClientEnv = {} satisfies Record<
	`NEXT_PUBLIC_${string}`,
	z.ZodType
>;

export const appClientRuntimeEnv = {} satisfies Record<
	keyof typeof appClientEnv,
	string | undefined
>;
