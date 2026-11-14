import type { AppUrls } from "./lib/urls";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Extra or replaced marketing URLs, merged over the kit `urls` by
 * `lib/urls.ts` (kit keys stay unless you set the same key) — add yours
 * here instead of editing that file. Read by client components (navbar):
 * import only client-safe modules (`@fuutu/env/marketing` is fine).
 *
 * Keep `satisfies AppUrls` (not a type annotation) so `urls.<key>` stays
 * typed. A kit key set here replaces the kit value whole (`auth` too).
 *
 * ```ts
 * export const appUrls = {
 *   discord: "https://discord.gg/acme",
 *   contact: { supportEmail: "mailto:support@acme.dev", consulting: "https://cal.com/acme" },
 * } satisfies AppUrls;
 * ```
 */
export const appUrls = {} satisfies AppUrls;
