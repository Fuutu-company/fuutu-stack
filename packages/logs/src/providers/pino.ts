import type { LogProvider } from "../types";

// Skeleton: install `pino` and wire it up here when switching providers.
export const pinoProvider: LogProvider = {
	log(_level, _message, _context) {
		throw new Error(
			"pino provider not yet implemented — install pino and wire it up.",
		);
	},
};
