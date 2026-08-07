export interface CronConfig {
	jobs: {
		webhookRetry: boolean;
		auditLogCleanup: boolean;
		subscriptionReminder: boolean;
		telemetryPing: boolean;
	};
}

export const cronConfig: CronConfig = {
	jobs: {
		webhookRetry: true,
		auditLogCleanup: true,
		subscriptionReminder: true,
		telemetryPing: true,
	},
};
