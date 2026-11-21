export function excludedTestsConfig(entries: readonly string[]): {
	testIgnore?: string[];
	grepInvert?: RegExp;
};

export const KIT_DEMO_TAG: string;

export function withKitDemoFilter(
	config: { testIgnore?: string[]; grepInvert?: RegExp },
	env?: Record<string, string | undefined>,
): { testIgnore?: string[]; grepInvert?: RegExp | RegExp[] };
