import type { ComponentType } from "react";

/** Places in the main window's frame your app can fill (`src/app-shell-slot.tsx`). */
export type AppShellSlots = {
	/** Under the app name, above the navigation. */
	sidebarTop?: ComponentType;
	/** Above the About button at the sidebar's bottom. */
	sidebarBottom?: ComponentType;
	/** Above every page's content (after the access notice). */
	contentTop?: ComponentType;
	/** Rendered once next to the shell — dialogs, global listeners, toasts. */
	global?: ComponentType;
};
