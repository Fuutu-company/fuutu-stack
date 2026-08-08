import type { LogProvider } from "../types";

// Skeleton: uses AXIOM_TOKEN once wired up.
export const axiomProvider: LogProvider = {
	log() {
		throw new Error(
			"axiom provider not yet implemented — wire up @axiomhq/js with AXIOM_TOKEN.",
		);
	},
};
