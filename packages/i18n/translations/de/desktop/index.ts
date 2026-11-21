import about from "./about.json";
import account from "./account.json";
import auth from "./auth.json";
import settings from "./settings.json";
import shell from "./shell.json";
import updates from "./updates.json";

/**
 * Desktop app (`apps/desktop`) — nested under `desktop` so its namespaces
 * never collide with the web apps' (`settings`, `nav`, …).
 */
export default {
	desktop: {
		shell,
		settings,
		about,
		auth,
		account,
		updates,
	},
} as const;
