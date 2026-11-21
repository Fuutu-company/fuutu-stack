import type { AppShellSlots } from "@/lib/shell-slots";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Your components in the main window's frame (`components/app-shell.tsx`):
 * `sidebarTop`, `sidebarBottom`, `contentTop` and `global` (rendered once,
 * e.g. a command palette or a global shortcut listener). Client
 * components; leave a slot out to keep the kit's frame there.
 *
 * ```tsx
 * import { QuickCapture } from "@/modules/capture/quick-capture";
 * export const appShellSlots: AppShellSlots = { global: QuickCapture };
 * ```
 */
export const appShellSlots: AppShellSlots = {};
