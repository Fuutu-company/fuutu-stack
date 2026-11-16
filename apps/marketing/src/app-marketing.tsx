import type { AppMarketing } from "./lib/extensions";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Extensions for the marketing site (contract: `lib/extensions.ts`) — add
 * yours here instead of editing the home page or the pricing module:
 *
 * - `homeSections`: compose `/` from the kit sections (`hero`,
 *   `integrations`, `features`, `product-tour`, `security`, `pricing`,
 *   `faq`, `cta`) — `insert` after a key, `replace` a component,
 *   `remove` by key
 * - `PricingCards`: `{ Home, Page }` replace the kit pricing cards on the
 *   home page and on `/pricing`
 *
 * Section components render without props; UI strings come from
 * translations, no literals. Navbar and footer links:
 * `src/app-site-links.ts` (client-safe — this file is server-only).
 *
 * ```tsx
 * export const appMarketing: AppMarketing = {
 *   homeSections: {
 *     insert: [{ key: "showcase", after: "features", Component: Showcase }],
 *     replace: { hero: MyHero },
 *     remove: ["product-tour"],
 *   },
 * };
 * ```
 */
export const appMarketing: AppMarketing = {};
