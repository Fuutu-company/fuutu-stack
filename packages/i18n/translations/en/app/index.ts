import type { AppTranslations } from "../../../types";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Your own messages and overrides of kit messages, merged LAST — your keys
 * win over the kit's, arrays are replaced (not concatenated). Sections map
 * to the kit namespaces: `common` (all apps), `marketing`, `saas`, `docs`,
 * `desktop`.
 * Keep the same keys in every locale folder (`pnpm check-translations`);
 * the `en` file also types `t("yourKey")`.
 *
 * ```ts
 * import myPage from "./my-page.json";
 * import tagline from "./tagline.json";
 *
 * export const appTranslations = {
 *   saas: { myPage },
 *   common: { app: tagline }, // overrides the kit's `app` keys it names
 * } satisfies AppTranslations;
 * ```
 */
export const appTranslations = {} satisfies AppTranslations;
