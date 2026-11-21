import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Desktop app env surface (`apps/desktop`, a static export inside Tauri).
 *
 * Public build-time variables ONLY — everything here is inlined into the
 * shipped app bundle, which end users can unpack. Never add a secret: no
 * DB, auth, payments, storage or licence values (they stay in
 * `@fuutu/env/saas` and the CI secrets).
 */
export const env = createEnv({
	server: {},
	shared: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	client: {
		/** Backend the app signs in to and calls (`apps/saas`). */
		NEXT_PUBLIC_SAAS_URL: z.url().optional(),
		/** Marketing site (pricing / download links). */
		NEXT_PUBLIC_MARKETING_URL: z.url().optional(),
		/**
		 * `desktopConfig.updates.source: "static"`: public base URL of the
		 * update manifests (`<url>/<channel>/latest.json`).
		 */
		NEXT_PUBLIC_DESKTOP_UPDATE_URL: z.url().optional(),
	},
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_SAAS_URL: process.env.NEXT_PUBLIC_SAAS_URL,
		NEXT_PUBLIC_MARKETING_URL: process.env.NEXT_PUBLIC_MARKETING_URL,
		NEXT_PUBLIC_DESKTOP_UPDATE_URL: process.env.NEXT_PUBLIC_DESKTOP_UPDATE_URL,
	},
	emptyStringAsUndefined: true,
});
