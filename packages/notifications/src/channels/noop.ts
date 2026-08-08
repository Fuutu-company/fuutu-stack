import type { NotificationChannelHandler } from "../types";

export const noopChannel: NotificationChannelHandler = {
	channel: "noop",
	async send() {
		// no-op — for testing
	},
};
