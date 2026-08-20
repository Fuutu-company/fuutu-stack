import { log as evlogLog } from "evlog";
import type { LogProvider } from "../types";

export const evlogProvider: LogProvider = {
	log(level, message, context) {
		const tag = context?.scope ?? "app";
		const meta = context?.meta;
		if (meta && Object.keys(meta).length > 0) {
			// Wide-event form: structured object
			(evlogLog[level] as (event: Record<string, unknown>) => void)({
				tag,
				message,
				...meta,
			});
		} else {
			evlogLog[level](tag, message);
		}
	},
};
