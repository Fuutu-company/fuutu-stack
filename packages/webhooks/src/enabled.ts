import { config } from "@fuutu/config";

/**
 * Outgoing webhooks are on (`config.features.webhooks`). Read at call
 * time, so a flag flip in tests or config applies immediately. Packages
 * that gate on the module (the retry cron job) read it from here.
 */
export function isWebhooksEnabled(): boolean {
	return config.features.webhooks;
}
