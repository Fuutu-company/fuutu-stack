export function parseConfiguredLocales(source: string): string[] | null;
export function partitionLocaleDirs(
	dirs: readonly string[],
	configured: readonly string[],
): { enabled: string[]; dormant: string[]; missing: string[] };
