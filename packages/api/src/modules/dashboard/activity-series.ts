import type { DashboardArea } from "./feed";

export const ACTIVITY_DAYS = 30;

const DAY_MS = 86_400_000;

export type ActivityDay = { date: string } & Record<DashboardArea, number>;

export type ActivityEvent = { area: DashboardArea; at: Date };

const utcDate = (d: Date) => d.toISOString().slice(0, 10);

/** Start (00:00 UTC) of the oldest day in the window ending today. */
export function activityWindowStart(now: Date): Date {
	const today = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
	);
	return new Date(today - (ACTIVITY_DAYS - 1) * DAY_MS);
}

/**
 * Daily event counts per area for exactly `ACTIVITY_DAYS` UTC days ending
 * today, oldest first. Events outside the window are ignored.
 */
export function buildActivitySeries(
	events: ActivityEvent[],
	now: Date,
): ActivityDay[] {
	const start = activityWindowStart(now).getTime();
	const days: ActivityDay[] = Array.from({ length: ACTIVITY_DAYS }, (_, i) => ({
		date: utcDate(new Date(start + i * DAY_MS)),
		users: 0,
		billing: 0,
		ai: 0,
		api: 0,
	}));
	for (const event of events) {
		const index = Math.floor((event.at.getTime() - start) / DAY_MS);
		const day = days[index];
		if (index >= 0 && day) day[event.area] += 1;
	}
	return days;
}
