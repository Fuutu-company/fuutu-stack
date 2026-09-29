/**
 * Minimal cron-expression matching for the schedule strings used by the
 * job registry (standard 5-field syntax: `minute hour day-of-month month
 * day-of-week`). Supports wildcards, step values, ranges, `range/step`
 * and comma-separated lists. Times are evaluated in the server's local
 * timezone, matching how
 * classic cron daemons interpret schedules.
 *
 * This is deliberately not a full cron implementation — no named months or
 * weekdays, no `?`/`L`/`W`/`#` extensions.
 */

export interface ParsedCron {
	minute: ReadonlySet<number>;
	hour: ReadonlySet<number>;
	dayOfMonth: ReadonlySet<number>;
	/** `true` when the field was `*` — needed for the dom/dow OR rule. */
	dayOfMonthAny: boolean;
	month: ReadonlySet<number>;
	dayOfWeek: ReadonlySet<number>;
	dayOfWeekAny: boolean;
}

interface FieldRange {
	min: number;
	max: number;
	/** Value to normalize to `min` when it equals `max` (day-of-week 7 → 0). */
	normalizeMaxTo?: number;
}

function parseField(
	expr: string,
	{ min, max, normalizeMaxTo }: FieldRange,
): { values: Set<number>; any: boolean } {
	const values = new Set<number>();
	let any = false;

	for (const part of expr.split(",")) {
		if (part === "") {
			throw new Error(`Empty item in cron field "${expr}"`);
		}
		const [rangePart, stepPart] = part.split("/");
		const step =
			stepPart === undefined ? 1 : Number.parseInt(stepPart ?? "", 10);
		if (!Number.isInteger(step) || step < 1) {
			throw new Error(`Invalid step in cron field "${expr}"`);
		}

		let lo = min;
		let hi = max;
		if (rangePart === "*") {
			any = step === 1;
		} else if (rangePart?.includes("-")) {
			const [a, b] = rangePart.split("-");
			lo = Number.parseInt(a ?? "", 10);
			hi = Number.parseInt(b ?? "", 10);
		} else {
			lo = Number.parseInt(rangePart ?? "", 10);
			hi = stepPart === undefined ? lo : max;
		}

		if (
			!Number.isInteger(lo) ||
			!Number.isInteger(hi) ||
			lo < min ||
			hi > max ||
			lo > hi
		) {
			throw new Error(`Invalid cron field "${expr}"`);
		}
		for (let v = lo; v <= hi; v += step) {
			values.add(v === normalizeMaxTo ? min : v);
		}
	}

	return { values, any };
}

/**
 * Parse a 5-field cron expression into matchable field sets.
 * Throws on malformed input — callers that want lenient handling should
 * use `isJobDue`, which fails open.
 */
export function parseCronExpression(expression: string): ParsedCron {
	const fields = expression.trim().split(/\s+/);
	if (fields.length !== 5) {
		throw new Error(
			`Cron expression must have 5 fields, got ${fields.length}: "${expression}"`,
		);
	}
	const minute = parseField(fields[0] ?? "", { min: 0, max: 59 });
	const hour = parseField(fields[1] ?? "", { min: 0, max: 23 });
	const dayOfMonth = parseField(fields[2] ?? "", { min: 1, max: 31 });
	const month = parseField(fields[3] ?? "", { min: 1, max: 12 });
	// Sunday can be written as 0 or 7 — normalize 7 to 0.
	const dayOfWeek = parseField(fields[4] ?? "", {
		min: 0,
		max: 7,
		normalizeMaxTo: 7,
	});
	return {
		minute: minute.values,
		hour: hour.values,
		dayOfMonth: dayOfMonth.values,
		dayOfMonthAny: dayOfMonth.any,
		month: month.values,
		dayOfWeek: dayOfWeek.values,
		dayOfWeekAny: dayOfWeek.any,
	};
}

/**
 * Whether `date` matches the parsed expression. Standard cron semantics:
 * when both day-of-month and day-of-week are restricted, either one
 * matching is enough (OR); otherwise both must match.
 */
export function cronMatches(parsed: ParsedCron, date: Date): boolean {
	if (!parsed.minute.has(date.getMinutes())) return false;
	if (!parsed.hour.has(date.getHours())) return false;
	if (!parsed.month.has(date.getMonth() + 1)) return false;

	const domMatches = parsed.dayOfMonth.has(date.getDate());
	const dowMatches = parsed.dayOfWeek.has(date.getDay());
	if (parsed.dayOfMonthAny && parsed.dayOfWeekAny) return true;
	if (parsed.dayOfMonthAny) return dowMatches;
	if (parsed.dayOfWeekAny) return domMatches;
	return domMatches || dowMatches;
}

const MINUTE_MS = 60_000;
/** Lookback cap: ~400 days covers every schedule sparser than yearly. */
const MAX_LOOKBACK_MS = 400 * 24 * 60 * MINUTE_MS;

/**
 * The most recent minute boundary ≤ `now` that matches the expression, or
 * `null` when nothing matches within the lookback window.
 */
export function previousScheduledRun(
	expression: string,
	now: Date,
): Date | null {
	const parsed = parseCronExpression(expression);
	const start = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS;
	for (let t = start; t >= start - MAX_LOOKBACK_MS; t -= MINUTE_MS) {
		if (cronMatches(parsed, new Date(t))) {
			return new Date(t);
		}
	}
	return null;
}

/**
 * Whether a job with `schedule` is due at `now` given its `lastRunAt`.
 * Never-run jobs are due. Unparseable schedules fail open (job runs every
 * trigger) so a typo degrades to the pre-scheduling behaviour instead of
 * silently disabling a job.
 */
export function isJobDue(
	schedule: string,
	lastRunAt: Date | null | undefined,
	now: Date = new Date(),
): boolean {
	if (!lastRunAt) return true;
	try {
		const previous = previousScheduledRun(schedule, now);
		if (!previous) return true;
		return previous.getTime() > lastRunAt.getTime();
	} catch {
		return true;
	}
}
