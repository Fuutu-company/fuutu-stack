import type { NextConfig } from "next";

type Redirect = Awaited<
	ReturnType<NonNullable<NextConfig["redirects"]>>
>[number];

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Redirects for the docs app, served by `next.config.ts` — add moved or
 * renamed pages here instead of editing that file. Next.js redirect
 * entries (`source`, `destination`, `permanent`); locale-prefixed docs
 * live under `/<locale>/docs/…`, the default locale under `/docs/…`.
 *
 * ```ts
 * export const appRedirects: Redirect[] = [
 *   { source: "/docs/old-page", destination: "/docs/new-page", permanent: true },
 * ];
 * ```
 */
export const appRedirects: Redirect[] = [];
