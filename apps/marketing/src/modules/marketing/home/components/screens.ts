/**
 * Product screenshots shown on the landing, served from `public/screens/`.
 * Regenerate them with `apps/marketing/scripts/capture-screens.ts` — it
 * writes these exact file names at this size.
 */

export const SCREEN_SIZE = { width: 1280, height: 800 } as const;

export const SCREENS = {
	dashboardLight: "/screens/dashboard-light.png",
	dashboardDark: "/screens/dashboard-dark.png",
	assistant: "/screens/chat.png",
	team: "/screens/team.png",
} as const;

export type ScreenId = keyof typeof SCREENS;
