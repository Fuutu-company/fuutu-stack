/**
 * Canonical `cn` lives in `@fuutu/utils/cn`. This module re-exports it so
 * existing `../lib/utils` imports across UI components keep working without
 * a repo-wide refactor. New code should import from `@fuutu/utils` directly.
 */
export { cn } from "@fuutu/utils/cn";
