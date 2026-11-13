import type { AppDocs } from "./lib/extensions";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Extensions for the docs app (contract: `lib/extensions.ts`) — add yours
 * here instead of editing `mdx-components.tsx`, the docs layout or the
 * docs page:
 *
 * - `mdxComponents`: extra MDX components for every page (merged after
 *   the kit set — same name overrides a kit component)
 * - `SidebarBanner({ locale })`: top of the docs sidebar
 * - `PageActions({ url, markdownUrl, locale })`: after the kit page
 *   actions (Copy Markdown / Open)
 *
 * UI strings come from translations (`docs.*` namespace), no literals.
 * Redirects for moved pages go in `apps/docs/app-redirects.ts`.
 *
 * ```tsx
 * export const appDocs: AppDocs = {
 *   mdxComponents: { Callout: MyCallout },
 *   SidebarBanner: ({ locale }) => <VersionBadge locale={locale} />,
 * };
 * ```
 */
export const appDocs: AppDocs = {};
