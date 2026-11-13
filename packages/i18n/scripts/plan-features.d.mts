export function extractVisiblePlanFeatures(
	configSource: string,
): Record<string, string[]> | null;
export function findMissingPlanFeatureLabels(
	planFeatures: Record<string, readonly string[]>,
	plans:
		| Record<string, { featureLabels?: Record<string, unknown> } | undefined>
		| undefined,
	locale: string,
): string[];
