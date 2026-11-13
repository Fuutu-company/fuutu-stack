export interface StackedSegment<K extends string> {
	key: K;
	value: number;
	/** Segment height as a percentage of the tallest bar. */
	pct: number;
}

export interface StackedBar<K extends string> {
	total: number;
	/** Bar height as a percentage of the tallest bar. */
	pct: number;
	/** Non-zero segments, bottom to top in key order. */
	segments: StackedSegment<K>[];
}

export interface StackedBars<K extends string> {
	bars: StackedBar<K>[];
	max: number;
	total: number;
	/** Index of the busiest bar (first on ties); -1 when there are no events. */
	peakIndex: number;
}

/** Geometry for a stacked bar chart: rows in, percentage heights out (layout is the caller's). */
export function buildStackedBars<K extends string>(
	rows: readonly Record<K, number>[],
	keys: readonly K[],
): StackedBars<K> {
	const totals = rows.map((row) => keys.reduce((sum, k) => sum + row[k], 0));
	const max = totals.reduce((m, t) => Math.max(m, t), 0);
	const pctOf = (n: number) => (max === 0 ? 0 : (n / max) * 100);

	const bars = rows.map((row, i) => ({
		total: totals[i] ?? 0,
		pct: pctOf(totals[i] ?? 0),
		segments: keys
			.filter((k) => row[k] > 0)
			.map((k) => ({ key: k, value: row[k], pct: pctOf(row[k]) })),
	}));

	return {
		bars,
		max,
		total: totals.reduce((sum, t) => sum + t, 0),
		peakIndex: max === 0 ? -1 : totals.indexOf(max),
	};
}
