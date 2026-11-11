/**
 * Version of YOUR app — the product you build on top of the kit.
 *
 * Source of truth: `"version"` in the repo-root `package.json`
 * (starts at `0.0.0`). Bump it with `pnpm version <patch|minor|major>`
 * or your release tooling. Never confuse it with `KIT_VERSION`
 * (`./index.ts`), which belongs to Fuutu and only changes when you merge
 * a kit update.
 *
 * Separate subpath (`@fuutu/config/app-version`) so the root
 * `package.json` is never pulled into client bundles via `@fuutu/config`.
 * Server-side use only.
 */
import rootPackage from "../../package.json" with { type: "json" };

export const APP_VERSION: string = rootPackage.version;
