import type { LogProvider } from "../types";

const levelToMethod = {
	debug: "debug",
	info: "info",
	warn: "warn",
	error: "error",
} as const;

export const consoleProvider: LogProvider = {
	log(level, message, context) {
		const prefix = context?.scope ? `[${context.scope}]` : "";
		const method = levelToMethod[level];
		if (context?.meta && Object.keys(context.meta).length > 0) {
			console[method](prefix, message, context.meta);
		} else {
			console[method](prefix, message);
		}
	},
};
